package com.example.viasafe.model;

public class RiskArea {

    public double latitude;
    public double longitude;
    public SafetyLevel safetyLevel;
    public boolean isNightSensitive;

    public RiskArea() {
        // Needed for JSON deserialization
    }

    public RiskArea(double latitude, double longitude, SafetyLevel safetyLevel, boolean isNightSensitive) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.safetyLevel = safetyLevel;
        this.isNightSensitive = isNightSensitive;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public SafetyLevel getSafetyLevel() {
        return safetyLevel;
    }

    public boolean isNightSensitive() {
        return isNightSensitive;
    }
}

