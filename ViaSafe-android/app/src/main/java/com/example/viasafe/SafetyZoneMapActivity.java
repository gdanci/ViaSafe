package com.example.viasafe;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.example.viasafe.data.ClujSafetyZones;
import com.example.viasafe.model.SafetyLevel;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.CircleOptions;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.material.appbar.MaterialToolbar;

import java.util.List;

public class SafetyZoneMapActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final int REQ_LOCATION = 1201;
    private GoogleMap map;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_safety_zone_map);

        MaterialToolbar toolbar = findViewById(R.id.toolbarSafetyMap);
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material);
        toolbar.setNavigationOnClickListener(v -> {
            Intent intent = new Intent(SafetyZoneMapActivity.this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.safetyMapFragment);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        map = googleMap;
        map.getUiSettings().setZoomControlsEnabled(true);

        LatLng cluj = new LatLng(46.7712, 23.6236);
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(cluj, 13f));

        renderZones(ClujSafetyZones.getZones());
        enableMyLocationIfPermitted();
    }

    private void renderZones(List<ClujSafetyZones.Zone> zones) {
        if (map == null) return;
        map.clear();

        for (ClujSafetyZones.Zone zone : zones) {
            int stroke = getStrokeColor(zone.getLevel());
            int fill = getFillColor(zone.getLevel());
            double radius = 520 + (getLevelIndex(zone.getLevel()) * 90);

            map.addCircle(new CircleOptions()
                    .center(new LatLng(zone.getLatitude(), zone.getLongitude()))
                    .radius(radius)
                    .strokeWidth(3f)
                    .strokeColor(stroke)
                    .fillColor(fill));
        }
    }

    private void enableMyLocationIfPermitted() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            map.setMyLocationEnabled(true);
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
        }
    }

    private int getStrokeColor(SafetyLevel level) {
        switch (level) {
            case SAFE:
                return 0xFF4CAF50;
            case CAUTION:
                return 0xFFFBC02D;
            case WARNING:
                return 0xFFF57C00;
            case DANGER:
            default:
                return 0xFFD32F2F;
        }
    }

    private int getFillColor(SafetyLevel level) {
        switch (level) {
            case SAFE:
                return 0x554CAF50;
            case CAUTION:
                return 0x55FBC02D;
            case WARNING:
                return 0x55F57C00;
            case DANGER:
            default:
                return 0x55D32F2F;
        }
    }

    private int getLevelIndex(SafetyLevel level) {
        switch (level) {
            case SAFE:
                return 0;
            case CAUTION:
                return 1;
            case WARNING:
                return 2;
            case DANGER:
            default:
                return 3;
        }
    }
}
