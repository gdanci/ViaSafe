package com.example.viasafe.data;

import android.content.Context;

import com.example.viasafe.model.IncidentReport;
import com.example.viasafe.model.RiskArea;
import com.example.viasafe.model.RouteResponse;
import com.example.viasafe.network.ApiClient;
import com.example.viasafe.network.ApiService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SafetyRepository {

    public interface ReportsCallback {
        void onLoaded(List<IncidentReport> reports);
        void onError(String message);
    }

    public interface RiskCallback {
        void onLoaded(List<RiskArea> areas);
        void onError(String message);
    }

    public interface SimpleCallback {
        void onSuccess();
        void onError(String message);
    }

    public interface RouteCallback {
        void onLoaded(RouteResponse response);
        void onError(String message);
    }

    private static SafetyRepository INSTANCE;

    private final List<IncidentReport> reports = new ArrayList<>();
    private final List<RiskArea> riskAreas = new ArrayList<>();
    private final ApiService api;

    private SafetyRepository(Context context) {
        this.api = ApiClient.getApiService();
    }

    public static synchronized SafetyRepository getInstance(Context context) {
        if (INSTANCE == null) {
            INSTANCE = new SafetyRepository(context.getApplicationContext());
        }
        return INSTANCE;
    }

    public List<IncidentReport> getReports() {
        return Collections.unmodifiableList(reports);
    }

    public List<RiskArea> getRiskAreas() {
        return Collections.unmodifiableList(riskAreas);
    }

    public void refreshReports(final ReportsCallback callback) {
        api.getReports().enqueue(new Callback<List<IncidentReport>>() {
            @Override
            public void onResponse(Call<List<IncidentReport>> call, Response<List<IncidentReport>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    reports.clear();
                    reports.addAll(response.body());
                    callback.onLoaded(Collections.unmodifiableList(reports));
                } else {
                    callback.onError("Failed to load reports");
                }
            }

            @Override
            public void onFailure(Call<List<IncidentReport>> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void refreshRiskAreas(final RiskCallback callback) {
        api.getRiskMap().enqueue(new Callback<List<RiskArea>>() {
            @Override
            public void onResponse(Call<List<RiskArea>> call, Response<List<RiskArea>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    riskAreas.clear();
                    riskAreas.addAll(response.body());
                    callback.onLoaded(Collections.unmodifiableList(riskAreas));
                } else {
                    callback.onError("Failed to load risk map");
                }
            }

            @Override
            public void onFailure(Call<List<RiskArea>> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void submitReport(String title,
                             String description,
                             String category,
                             String timeLabel,
                             String locationLabel,
                             double latitude,
                             double longitude,
                             boolean anonymous,
                             final SimpleCallback callback) {
        Map<String, Object> body = new HashMap<>();
        body.put("title", title);
        body.put("description", description);
        body.put("category", category);
        body.put("timeLabel", timeLabel);
        body.put("locationLabel", locationLabel);
        body.put("latitude", latitude);
        body.put("longitude", longitude);
        body.put("anonymous", anonymous);

        api.submitReport(body).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> response) {
                if (response.isSuccessful()) {
                    callback.onSuccess();
                } else {
                    callback.onError("Failed to submit report");
                }
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void upvoteReport(String id, final SimpleCallback callback) {
        api.upvoteReport(id).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> response) {
                if (response.isSuccessful()) {
                    callback.onSuccess();
                } else {
                    callback.onError("Failed to upvote");
                }
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }

    public void requestSafeRoute(double startLat, double startLng, double endLat, double endLng, final RouteCallback callback) {
        Map<String, Object> body = new HashMap<>();
        body.put("startLat", startLat);
        body.put("startLng", startLng);
        body.put("endLat", endLat);
        body.put("endLng", endLng);

        api.getSafeRoute(body).enqueue(new Callback<RouteResponse>() {
            @Override
            public void onResponse(Call<RouteResponse> call, Response<RouteResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onLoaded(response.body());
                } else {
                    callback.onError("Failed to load route");
                }
            }

            @Override
            public void onFailure(Call<RouteResponse> call, Throwable t) {
                callback.onError(t.getMessage() != null ? t.getMessage() : "Network error");
            }
        });
    }
}
