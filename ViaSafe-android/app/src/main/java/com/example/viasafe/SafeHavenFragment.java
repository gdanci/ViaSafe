package com.example.viasafe;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

public class SafeHavenFragment extends Fragment {

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_safe_haven, container, false);

        Button btnHospitals = root.findViewById(R.id.btnHospitals);
        Button btnPolice = root.findViewById(R.id.btnPolice);
        Button btnPharmacies = root.findViewById(R.id.btnPharmacies);
        Button btnCoffee = root.findViewById(R.id.btnCoffee);

        btnHospitals.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPlacesSearch("hospital");
            }
        });

        btnPolice.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPlacesSearch("police station");
            }
        });

        btnPharmacies.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPlacesSearch("24/7 pharmacy");
            }
        });

        btnCoffee.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPlacesSearch("24/7 coffee shop");
            }
        });

        return root;
    }

    private void openPlacesSearch(String query) {
        if (getContext() == null) {
            return;
        }
        // Opens Google Maps (or default maps app) with nearby safe haven search.
        Uri uri = Uri.parse("geo:0,0?q=" + Uri.encode(query + " near Cluj-Napoca"));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage("com.google.android.apps.maps");
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            // Fallback without forcing Google Maps package
            intent.setPackage(null);
        }
        startActivity(intent);
    }
}

