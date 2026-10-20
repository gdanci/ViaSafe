package com.example.viasafe;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Looper;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.example.viasafe.network.ApiClient;
import com.example.viasafe.network.ApiService;
import com.example.viasafe.network.model.SosStartResponse;
import com.example.viasafe.network.model.SosStopResponse;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import retrofit2.Call;
import retrofit2.Callback;
import okhttp3.Response;

public class SosManager {

    private static SosManager INSTANCE;

    private final ApiService api;
    private final OkHttpClient httpClient;
    private final FusedLocationProviderClient locationClient;
    private WebSocket webSocket;
    private LocationCallback locationCallback;
    private boolean active;
    private String sessionId;

    private SosManager(Context context) {
        api = ApiClient.getApiService();
        httpClient = ApiClient.getHttpClient();
        locationClient = LocationServices.getFusedLocationProviderClient(context);
    }

    public static synchronized SosManager getInstance(Context context) {
        if (INSTANCE == null) {
            INSTANCE = new SosManager(context.getApplicationContext());
        }
        return INSTANCE;
    }

    public void startSos(Context context) {
        if (active) {
            Toast.makeText(context, "SOS already active.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(context, "Location permission missing.", Toast.LENGTH_SHORT).show();
            return;
        }

        locationClient.getLastLocation().addOnSuccessListener(location -> {
            Double lat = location != null ? location.getLatitude() : null;
            Double lng = location != null ? location.getLongitude() : null;
            startSosInternal(context, lat, lng);
        }).addOnFailureListener(err -> startSosInternal(context, null, null));
    }

    private void startSosInternal(Context context, Double lat, Double lng) {
        java.util.HashMap<String, Object> body = new java.util.HashMap<>();
        if (lat != null && lng != null) {
            body.put("lat", lat);
            body.put("lng", lng);
        }
        api.startSos(body).enqueue(new Callback<SosStartResponse>() {
            @Override
            public void onResponse(Call<SosStartResponse> call, retrofit2.Response<SosStartResponse> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    Toast.makeText(context, "Could not start SOS.", Toast.LENGTH_SHORT).show();
                    return;
                }
                SosStartResponse data = response.body();
                sessionId = data.sessionId;
                openWebSocket(data.wsPublisherUrl);
                startLocationUpdates(context);

                Intent intent = new Intent(context, FakeCallActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);

                active = true;
                Toast.makeText(context, "SOS sent to your contacts with your location.", Toast.LENGTH_LONG).show();
                Intent broadcast = new Intent("com.example.viasafe.SOS_SENT");
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcast);
            }

            @Override
            public void onFailure(Call<SosStartResponse> call, Throwable t) {
                Toast.makeText(context, "Could not start SOS.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void stopSos(Context context) {
        if (!active) return;
        api.stopSos().enqueue(new Callback<SosStopResponse>() {
            @Override
            public void onResponse(Call<SosStopResponse> call, retrofit2.Response<SosStopResponse> response) {
                // best effort
            }

            @Override
            public void onFailure(Call<SosStopResponse> call, Throwable t) {
            }
        });
        stopLocationUpdates();
        if (webSocket != null) {
            webSocket.close(1000, "SOS stopped");
            webSocket = null;
        }
        active = false;
        sessionId = null;
        Toast.makeText(context, "SOS stopped.", Toast.LENGTH_SHORT).show();
    }

    private void openWebSocket(String wsUrl) {
        if (wsUrl == null || wsUrl.isEmpty()) return;
        Request request = new Request.Builder()
                .url(wsUrl)
                .addHeader("X-User-Id", ApiClient.getUserId())
                .build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
            }
        });
    }

    private void startLocationUpdates(Context context) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(context, "Location permission missing.", Toast.LENGTH_SHORT).show();
            return;
        }
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                .setMinUpdateIntervalMillis(3000)
                .build();
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result.getLastLocation() == null || webSocket == null) return;
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("lat", result.getLastLocation().getLatitude());
                    payload.put("lng", result.getLastLocation().getLongitude());
                    payload.put("ts", System.currentTimeMillis());
                    payload.put("accuracy", result.getLastLocation().getAccuracy());
                    webSocket.send(payload.toString());
                } catch (Exception ignored) {
                }
            }
        };
        locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
    }

    private void stopLocationUpdates() {
        if (locationCallback != null) {
            locationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
    }
}

