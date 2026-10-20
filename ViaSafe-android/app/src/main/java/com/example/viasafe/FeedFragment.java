package com.example.viasafe;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.example.viasafe.data.SafetyRepository;
import com.example.viasafe.model.IncidentReport;

import java.util.List;

public class FeedFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_feed, container, false);
        LinearLayout containerLayout = root.findViewById(R.id.feedContainer);

        if (getContext() != null) {
            SafetyRepository repo = SafetyRepository.getInstance(getContext());
            renderReports(containerLayout, repo.getReports());

            repo.refreshReports(new SafetyRepository.ReportsCallback() {
                @Override
                public void onLoaded(List<IncidentReport> reports) {
                    renderReports(containerLayout, reports);
                }

                @Override
                public void onError(String message) {
                    if (getContext() != null) {
                        Toast.makeText(getContext(), "Could not load reports: " + message, Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        return root;
    }

    private void renderReports(LinearLayout containerLayout, List<IncidentReport> reports) {
        if (getContext() == null) return;
        containerLayout.removeAllViews();
        LayoutInflater li = LayoutInflater.from(getContext());

        for (IncidentReport report : reports) {
            View card = li.inflate(R.layout.item_feed_report, containerLayout, false);

            TextView title = card.findViewById(R.id.textReportTitle);
            TextView meta = card.findViewById(R.id.textReportMeta);
            TextView description = card.findViewById(R.id.textReportDescription);
            TextView verification = card.findViewById(R.id.textVerification);
            Button upvote = card.findViewById(R.id.btnUpvote);

            title.setText(report.getTitle());
            meta.setText(report.getLocationLabel() + " \u2022 " + report.getTimeLabel());
            description.setText(report.getDescription());

            updateVerificationText(verification, report);

            upvote.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (getContext() == null) return;
                    SafetyRepository.getInstance(getContext()).upvoteReport(report.getId(), new SafetyRepository.SimpleCallback() {
                        @Override
                        public void onSuccess() {
                            report.incrementUpvotes();
                            updateVerificationText(verification, report);
                        }

                        @Override
                        public void onError(String message) {
                            Toast.makeText(getContext(), "Upvote failed: " + message, Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            });

            containerLayout.addView(card);
        }
    }

    private void updateVerificationText(TextView verification, IncidentReport report) {
        if (report.getVerificationStatus() == IncidentReport.VerificationStatus.VERIFIED) {
            verification.setText("Verified (" + report.getUpvotes() + " helpful)");
        } else {
            verification.setText("Single report (" + report.getUpvotes() + " helpful)");
        }
    }
}