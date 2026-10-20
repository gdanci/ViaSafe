package com.example.viasafe;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.example.viasafe.data.SafetyRepository;
import com.example.viasafe.model.IncidentReport;
import com.example.viasafe.model.RouteResponse;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.Polyline;
import com.google.android.gms.maps.model.PolylineOptions;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;

public class PinPointMapActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final int REQ_LOCATION = 1202;
    private GoogleMap map;
    private Marker selectedMarker;
    private LatLng selectedLatLng;
    private TextView textSelectedLocation;
    private Button btnUseLocation;
    private Button btnUpvotePin;
    private Button btnRoute;
    private Button btnClearRoute;
    private View pinBottomBar;
    private View pinTypePanel;
    private View routePanel;
    private Button btnOpenPinTypes;
    private Button btnOpenRoutePanel;
    private Button btnPinBack;
    private Button btnRouteBack;
    private ChipGroup chipGroupPinType;
    private ReportTag selectedReportTag;
    private Polyline routeLine;
    private LatLng currentLocation;
    private FusedLocationProviderClient fusedLocationClient;

    private static final class ReportTag {
        final String id;
        final String type;

        ReportTag(String id, String type) {
            this.id = id;
            this.type = type;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pin_point_map);

        MaterialToolbar toolbar = findViewById(R.id.toolbarPinMap);
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material);
        toolbar.setNavigationOnClickListener(v -> {
            Intent intent = new Intent(PinPointMapActivity.this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });

        pinBottomBar = findViewById(R.id.pinBottomBar);
        pinTypePanel = findViewById(R.id.pinTypePanel);
        routePanel = findViewById(R.id.routePanel);
        btnOpenPinTypes = findViewById(R.id.btnOpenPinTypes);
        btnOpenRoutePanel = findViewById(R.id.btnOpenRoutePanel);
        btnPinBack = findViewById(R.id.btnPinBack);
        btnRouteBack = findViewById(R.id.btnRouteBack);

        chipGroupPinType = findViewById(R.id.chipGroupPinType);
        chipGroupPinType.check(R.id.chipPinGroup);
        chipGroupPinType.setOnCheckedChangeListener((group, checkedId) -> updateSelectedLocationText());

        textSelectedLocation = findViewById(R.id.textSelectedLocation);
        btnUseLocation = findViewById(R.id.btnUseLocation);
        btnUpvotePin = findViewById(R.id.btnUpvotePin);
        btnRoute = findViewById(R.id.btnRoute);
        btnClearRoute = findViewById(R.id.btnClearRoute);
        btnUseLocation.setEnabled(false);
        btnUpvotePin.setEnabled(false);
        btnRoute.setEnabled(false);
        btnClearRoute.setEnabled(false);

        btnOpenPinTypes.setOnClickListener(v -> showPinPanel());
        btnOpenRoutePanel.setOnClickListener(v -> showRoutePanel());
        btnPinBack.setOnClickListener(v -> showBottomBar());
        btnRouteBack.setOnClickListener(v -> showBottomBar());

        btnUseLocation.setOnClickListener(v -> {
            if (selectedLatLng == null) return;
            String type = getSelectedPinType();
            savePinpointToDatabase(type, selectedLatLng);
        });

        btnUpvotePin.setOnClickListener(v -> {
            if (selectedReportTag == null) {
                Toast.makeText(this, "Tap a pin to select it first.", Toast.LENGTH_SHORT).show();
                return;
            }
            upvoteSelectedPin();
        });

        btnRoute.setOnClickListener(v -> {
            if (currentLocation == null) {
                Toast.makeText(this, "Waiting for GPS location...", Toast.LENGTH_SHORT).show();
                return;
            }
            if (selectedLatLng == null) {
                Toast.makeText(this, "Tap a destination on the map first.", Toast.LENGTH_SHORT).show();
                return;
            }
            requestSafeRoute(currentLocation, selectedLatLng);
        });

        btnClearRoute.setOnClickListener(v -> clearRoute());

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.pinMapFragment);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        showBottomBar();
        updateSelectedLocationText();
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        map = googleMap;
        map.getUiSettings().setZoomControlsEnabled(true);

        LatLng cluj = new LatLng(46.7712, 23.6236);
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(cluj, 13f));
        map.addMarker(new MarkerOptions().position(cluj).title("Cluj-Napoca"));

        enableMyLocationIfPermitted();
        fetchCurrentLocation();

        map.setOnMapClickListener(latLng -> {
            selectedLatLng = latLng;
            selectedReportTag = null;
            btnUpvotePin.setEnabled(false);
            if (selectedMarker != null) selectedMarker.remove();
            selectedMarker = map.addMarker(new MarkerOptions()
                    .position(latLng)
                    .title("Selected location"));
            btnUseLocation.setEnabled(true);
            btnRoute.setEnabled(true);
            updateSelectedLocationText();
        });

        map.setOnMarkerClickListener(marker -> {
            Object tag = marker.getTag();
            if (tag instanceof ReportTag) {
                selectedReportTag = (ReportTag) tag;
                btnUpvotePin.setEnabled(true);
                Toast.makeText(this, "Pin selected. Tap Upvote.", Toast.LENGTH_SHORT).show();
                return true;
            }
            return false;
        });

        loadExistingPins();
    }

    private void updateSelectedLocationText() {
        String type = getSelectedPinType();
        if (selectedLatLng == null) {
            textSelectedLocation.setText("Type: " + type + " \u2022 Tap on the map to select a location");
        } else {
            textSelectedLocation.setText("Type: " + type + " \u2022 " + selectedLatLng.latitude + ", " + selectedLatLng.longitude);
        }
    }

    private void showBottomBar() {
        pinBottomBar.setVisibility(View.VISIBLE);
        pinTypePanel.setVisibility(View.GONE);
        routePanel.setVisibility(View.GONE);
    }

    private void showPinPanel() {
        pinBottomBar.setVisibility(View.GONE);
        pinTypePanel.setVisibility(View.VISIBLE);
        routePanel.setVisibility(View.GONE);
    }

    private void showRoutePanel() {
        pinBottomBar.setVisibility(View.GONE);
        pinTypePanel.setVisibility(View.GONE);
        routePanel.setVisibility(View.VISIBLE);
        fetchCurrentLocation();
    }

    private String getSelectedPinType() {
        if (chipGroupPinType == null) return "Unknown";
        int checkedId = chipGroupPinType.getCheckedChipId();
        Chip chip = checkedId != -1 ? chipGroupPinType.findViewById(checkedId) : null;
        return chip != null ? chip.getText().toString() : "Unknown";
    }

    private void enableMyLocationIfPermitted() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            map.setMyLocationEnabled(true);
            fetchCurrentLocation();
        } else {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    REQ_LOCATION
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED && map != null) {
            map.setMyLocationEnabled(true);
            fetchCurrentLocation();
        }
    }

    private void fetchCurrentLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (location == null) return;
            currentLocation = new LatLng(location.getLatitude(), location.getLongitude());
            btnRoute.setEnabled(selectedLatLng != null);
        });
    }

    private void savePinpointToDatabase(String type, LatLng latLng) {
        SafetyRepository.getInstance(this).submitReport(
                type,
                "Pinpoint reported from map",
                type,
                "Just now",
                "Cluj-Napoca",
                latLng.latitude,
                latLng.longitude,
                true,
                new SafetyRepository.SimpleCallback() {
                    @Override
                    public void onSuccess() {
                        loadExistingPins();
                        Toast.makeText(PinPointMapActivity.this, "Pinpoint saved.", Toast.LENGTH_SHORT).show();
                        // allow placing multiple pins without resetting selection
                    }

                    @Override
                    public void onError(String message) {
                        Toast.makeText(PinPointMapActivity.this, "Save failed: " + message, Toast.LENGTH_SHORT).show();
                    }
                }
        );
    }

    private void loadExistingPins() {
        SafetyRepository.getInstance(this).refreshReports(new SafetyRepository.ReportsCallback() {
            @Override
            public void onLoaded(java.util.List<IncidentReport> reports) {
                map.clear();
                selectedReportTag = null;
                btnUpvotePin.setEnabled(false);
                // keep current selection marker if any
                if (selectedLatLng != null) {
                    selectedMarker = map.addMarker(new MarkerOptions()
                            .position(selectedLatLng)
                            .title("Selected location"));
                }
                for (IncidentReport report : reports) {
                    if (report == null) continue;
                    if (!isPinType(report.getCategory())) continue;
                    addPinMarker(report.getId(), report.getCategory(),
                            new LatLng(report.getLatitude(), report.getLongitude()));
                }

                if (routeLine != null) {
                    PolylineOptions opts = new PolylineOptions()
                            .addAll(routeLine.getPoints())
                            .color(0xFFB66D5A)
                            .width(9f);
                    routeLine = map.addPolyline(opts);
                }
            }

            @Override
            public void onError(String message) {
                // keep silent if offline
            }
        });
    }

    private boolean isPinType(String category) {
        if (category == null) return false;
        String c = category.toLowerCase();
        return c.contains("suspicious")
                || c.contains("harassment")
                || c.contains("danger")
                || c.contains("lighting")
                || c.contains("isolated");
    }

    private void addPinMarker(String type, LatLng latLng) {
        if (map == null) return;
        float hue = getHueForType(type);
        map.addMarker(new MarkerOptions()
                .position(latLng)
                .title(type)
                .icon(BitmapDescriptorFactory.defaultMarker(hue)));
    }

    private void addPinMarker(String id, String type, LatLng latLng) {
        if (map == null) return;
        float hue = getHueForType(type);
        Marker marker = map.addMarker(new MarkerOptions()
                .position(latLng)
                .title(type)
                .icon(BitmapDescriptorFactory.defaultMarker(hue)));
        if (marker != null) {
            marker.setTag(new ReportTag(id, type));
        }
    }

    private void upvotePin(ReportTag reportTag) {
        SafetyRepository.getInstance(this).upvoteReport(reportTag.id, new SafetyRepository.SimpleCallback() {
            @Override
            public void onSuccess() {
                Toast.makeText(PinPointMapActivity.this, "Upvoted: " + reportTag.type, Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onError(String message) {
                Toast.makeText(PinPointMapActivity.this, "Upvote failed: " + message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void upvoteSelectedPin() {
        if (selectedReportTag == null) return;
        upvotePin(selectedReportTag);
    }

    private void requestSafeRoute(LatLng start, LatLng end) {
        SafetyRepository.getInstance(this).requestSafeRoute(start.latitude, start.longitude, end.latitude, end.longitude,
                new SafetyRepository.RouteCallback() {
                    @Override
                    public void onLoaded(RouteResponse response) {
                        if (response == null || response.trip == null || response.trip.legs == null || response.trip.legs.isEmpty()) {
                            Toast.makeText(PinPointMapActivity.this, "Route service not configured.", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        String shape = response.trip.legs.get(0).shape;
                        if (shape == null) {
                            Toast.makeText(PinPointMapActivity.this, "Route not available.", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        if (routeLine != null) {
                            routeLine.remove();
                        }
                        java.util.List<LatLng> points = decodePolyline6(shape);
                        routeLine = map.addPolyline(new PolylineOptions()
                                .addAll(points)
                                .color(0xFFB66D5A)
                                .width(9f));
                        btnClearRoute.setEnabled(true);
                    }

                    @Override
                    public void onError(String message) {
                        Toast.makeText(PinPointMapActivity.this, "Route failed: " + message, Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void clearRoute() {
        if (routeLine != null) {
            routeLine.remove();
            routeLine = null;
        }
        btnClearRoute.setEnabled(false);
    }

    // Decodes Valhalla polyline6 (1e6 precision)
    private java.util.List<LatLng> decodePolyline6(String encoded) {
        java.util.ArrayList<LatLng> poly = new java.util.ArrayList<>();
        int index = 0, len = encoded.length();
        long lat = 0, lng = 0;

        while (index < len) {
            long result = 0;
            int shift = 0;
            int b;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (long) (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            long dlat = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);
            lat += dlat;

            result = 0;
            shift = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (long) (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            long dlng = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);
            lng += dlng;

            double latD = lat / 1e6;
            double lngD = lng / 1e6;
            poly.add(new LatLng(latD, lngD));
        }
        return poly;
    }

    private float getHueForType(String type) {
        if (type == null) return BitmapDescriptorFactory.HUE_AZURE;
        String t = type.toLowerCase();
        if (t.contains("harassment") || t.contains("danger")) {
            return BitmapDescriptorFactory.HUE_RED;
        }
        if (t.contains("suspicious")) {
            return BitmapDescriptorFactory.HUE_ORANGE;
        }
        if (t.contains("lighting")) {
            return BitmapDescriptorFactory.HUE_BLUE;
        }
        if (t.contains("isolated")) {
            return BitmapDescriptorFactory.HUE_VIOLET;
        }
        return BitmapDescriptorFactory.HUE_AZURE;
    }
}
