package com.example.viasafe;

import android.content.Intent;
import android.os.Bundle;
import android.view.MenuItem;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomnavigation.BottomNavigationView;

public class MainActivity extends AppCompatActivity implements BottomNavigationView.OnNavigationItemSelectedListener {

    private BottomNavigationView bottomNavigationView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNavigationView = findViewById(R.id.bottom_navigation);
        bottomNavigationView.setOnNavigationItemSelectedListener(this);
        bottomNavigationView.setSelectedItemId(R.id.nav_map);

        handleIntent(getIntent());
    }

    @Override
    public boolean onNavigationItemSelected(@NonNull MenuItem item) {
        Fragment selected = null;
        int itemId = item.getItemId();
        if (itemId == R.id.nav_map) {
            selected = new MapFragment();
        } else if (itemId == R.id.nav_report) {
            selected = new ReportFragment();
        } else if (itemId == R.id.nav_safe_haven) {
            selected = new SafeHavenFragment();
        } else if (itemId == R.id.nav_feed) {
            selected = new FeedFragment();
        } else if (itemId == R.id.nav_profile) {
            selected = new ProfileFragment();
        }

        if (selected != null) {
            getSupportFragmentManager()
                    .beginTransaction()
                    .replace(R.id.fragment_container, selected)
                    .commit();
            return true;
        }

        return false;
    }

    public void selectTab(int menuId) {
        if (bottomNavigationView != null) {
            bottomNavigationView.setSelectedItemId(menuId);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("open_report", false)) {
            selectTab(R.id.nav_report);
        }
    }
}

