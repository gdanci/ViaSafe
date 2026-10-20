package com.example.viasafe;

import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.example.viasafe.data.SafetyRepository;
import com.example.viasafe.model.RiskArea;
import com.example.viasafe.model.SafetyLevel;

import java.util.List;

public class MapFragment extends Fragment {

    private static final int REQ_SOS = 3001;
    private static final String ACTION_SOS_SENT = "com.example.viasafe.SOS_SENT";
    private View sosStatusView;
    private final Handler sosHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideSosRunnable = new Runnable() {
        @Override
        public void run() {
            if (sosStatusView != null) {
                sosStatusView.setVisibility(View.GONE);
            }
        }
    };
    private final android.content.BroadcastReceiver sosReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(android.content.Context context, android.content.Intent intent) {
            if (sosStatusView != null) {
                sosStatusView.setVisibility(View.VISIBLE);
                sosHandler.removeCallbacks(hideSosRunnable);
                sosHandler.postDelayed(hideSosRunnable, 4000);
            }
        }
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_map, container, false);

        View fabSafeRoute = root.findViewById(R.id.fabSafeRoute);
        View fabSos = root.findViewById(R.id.fabSos);
        View pinPointAction = root.findViewById(R.id.actionPinPoint);
        sosStatusView = root.findViewById(R.id.textSosStatus);

        fabSafeRoute.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onSafeRouteClicked();
            }
        });

        pinPointAction.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (getContext() != null) {
                    startActivity(new Intent(getContext(), PinPointMapActivity.class));
                }
            }
        });

        fabSos.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startSosWithPermissions();
            }
        });

        updateRiskSummary();

        return root;
    }

    private void onSafeRouteClicked() {
        if (getContext() == null) {
            return;
        }
        startActivity(new Intent(getContext(), SafetyZoneMapActivity.class));
    }

    private void updateRiskSummary() {
        if (getContext() == null) {
            return;
        }
        SafetyRepository repo = SafetyRepository.getInstance(getContext());
        repo.refreshRiskAreas(new SafetyRepository.RiskCallback() {
            @Override
            public void onLoaded(List<RiskArea> areas) {
                showRiskToast(areas);
            }

            @Override
            public void onError(String message) {
                // Fall back to any cached values
                showRiskToast(repo.getRiskAreas());
            }
        });
    }

    private void showRiskToast(List<RiskArea> areas) {
        if (getContext() == null) return;
        int safe = 0, caution = 0, warning = 0, danger = 0;
        for (RiskArea area : areas) {
            SafetyLevel level = area.getSafetyLevel();
            if (level == SafetyLevel.SAFE) {
                safe++;
            } else if (level == SafetyLevel.CAUTION) {
                caution++;
            } else if (level == SafetyLevel.WARNING) {
                warning++;
            } else if (level == SafetyLevel.DANGER) {
                danger++;
            }
        }
        Toast.makeText(getContext(),
                "Risk map loaded: " + safe + " green, " + caution + " yellow, " + warning + " orange, " + danger + " red areas.",
                Toast.LENGTH_LONG).show();
    }

    private void startSosWithPermissions() {
        if (getContext() == null) return;
        boolean hasLocation = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean hasAudio = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;

        if (!hasLocation || !hasAudio) {
            requestPermissions(
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.RECORD_AUDIO},
                    REQ_SOS
            );
            return;
        }
        SosManager.getInstance(getContext()).startSos(getContext());
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getContext() != null) {
            android.content.IntentFilter filter = new android.content.IntentFilter(ACTION_SOS_SENT);
            androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(getContext())
                    .registerReceiver(sosReceiver, filter);
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (getContext() != null) {
            androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(getContext())
                    .unregisterReceiver(sosReceiver);
        }
        sosHandler.removeCallbacks(hideSosRunnable);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_SOS) {
            boolean granted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    granted = false;
                    break;
                }
            }
            if (granted) {
                startSosWithPermissions();
            } else if (getContext() != null) {
                Toast.makeText(getContext(), "Permissions are required for SOS.", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
