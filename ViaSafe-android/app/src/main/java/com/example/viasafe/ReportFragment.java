package com.example.viasafe;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.Toast;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.example.viasafe.data.SafetyRepository;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.checkbox.MaterialCheckBox;
import com.google.android.material.textfield.TextInputEditText;

public class ReportFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_report, container, false);

        TextInputEditText titleInput = root.findViewById(R.id.inputTitle);
        TextInputEditText descriptionInput = root.findViewById(R.id.inputDescription);
        TextInputEditText locationInput = root.findViewById(R.id.inputLocation);
        ChipGroup categoryGroup = root.findViewById(R.id.chipGroupCategory);
        ChipGroup timeGroup = root.findViewById(R.id.chipGroupTime);
        MaterialCheckBox anonymousCheck = root.findViewById(R.id.checkAnonymous);
        Button markLocationButton = root.findViewById(R.id.btnMarkLocation);
        Button submitButton = root.findViewById(R.id.btnSubmitReport);

        final double[] selectedLat = {46.7712};
        final double[] selectedLng = {23.6236};
        final boolean[] hasCustomLocation = {false};

        if (getContext() != null) {
            SharedPreferences prefs = getContext().getSharedPreferences("viasafe_prefs", Context.MODE_PRIVATE);
            String pendingLat = prefs.getString("pending_lat", null);
            String pendingLng = prefs.getString("pending_lng", null);
            String pendingLabel = prefs.getString("pending_label", null);
            String pendingType = prefs.getString("pending_type", null);
            if (pendingLat != null && pendingLng != null) {
                try {
                    selectedLat[0] = Double.parseDouble(pendingLat);
                    selectedLng[0] = Double.parseDouble(pendingLng);
                    hasCustomLocation[0] = true;
                    locationInput.setText(pendingLabel != null ? pendingLabel : "Pinned location");
                } catch (NumberFormatException ignored) {
                    // ignore invalid cached values
                }
            }
            applyPendingType(categoryGroup, pendingType);
        }

        markLocationButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // For now we just set a demo location.
                locationInput.setText("Current location (demo) \u2022 Cluj-Napoca");
                selectedLat[0] = 46.7712;
                selectedLng[0] = 23.6236;
                hasCustomLocation[0] = true;
                Toast.makeText(getContext(), "Using current location (demo). Later this comes from GPS / map pin.", Toast.LENGTH_SHORT).show();
            }
        });

        submitButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String title = titleInput.getText() != null ? titleInput.getText().toString().trim() : "";
                String description = descriptionInput.getText() != null ? descriptionInput.getText().toString().trim() : "";
                String location = locationInput.getText() != null ? locationInput.getText().toString().trim() : "";

                if (TextUtils.isEmpty(title) || TextUtils.isEmpty(description)) {
                    Toast.makeText(getContext(), "Please add a title and description.", Toast.LENGTH_SHORT).show();
                    return;
                }

                Chip selectedCategoryChip = categoryGroup.findViewById(categoryGroup.getCheckedChipId());
                String category = selectedCategoryChip != null ? selectedCategoryChip.getText().toString() : "Other";

                Chip selectedTimeChip = timeGroup.findViewById(timeGroup.getCheckedChipId());
                String timeLabel = selectedTimeChip != null ? selectedTimeChip.getText().toString() : "Unknown time";

                if (TextUtils.isEmpty(location)) {
                    location = "Location not specified";
                }

                boolean anonymous = anonymousCheck.isChecked();

                double lat = selectedLat[0];
                double lng = selectedLng[0];

                if (getContext() != null) {
                    SafetyRepository.getInstance(getContext())
                            .submitReport(title, description, category, timeLabel, location, lat, lng, anonymous,
                                    new SafetyRepository.SimpleCallback() {
                                        @Override
                                        public void onSuccess() {
                                            Toast.makeText(getContext(), "Report submitted. Thank you for helping other women stay safe.", Toast.LENGTH_LONG).show();
                                            titleInput.setText("");
                                            descriptionInput.setText("");
                                            locationInput.setText("");
                                            categoryGroup.clearCheck();
                                            timeGroup.clearCheck();
                                            anonymousCheck.setChecked(true);
                                            SharedPreferences prefs = getContext().getSharedPreferences("viasafe_prefs", Context.MODE_PRIVATE);
                                            prefs.edit().remove("pending_lat").remove("pending_lng").remove("pending_label").remove("pending_type").apply();
                                        }

                                        @Override
                                        public void onError(String message) {
                                            Toast.makeText(getContext(), "Submit failed: " + message, Toast.LENGTH_SHORT).show();
                                        }
                                    });
                }
            }
        });

        return root;
    }

    private void applyPendingType(ChipGroup categoryGroup, String pendingType) {
        if (categoryGroup == null || pendingType == null) return;
        String lower = pendingType.toLowerCase();
        if (lower.contains("suspicious")) {
            categoryGroup.check(R.id.chipGroup);
        } else if (lower.contains("harassment") || lower.contains("danger")) {
            categoryGroup.check(R.id.chipHarassment);
        } else if (lower.contains("lighting")) {
            categoryGroup.check(R.id.chipFollowed);
        } else if (lower.contains("isolated")) {
            categoryGroup.check(R.id.chipOther);
        }
    }
}
