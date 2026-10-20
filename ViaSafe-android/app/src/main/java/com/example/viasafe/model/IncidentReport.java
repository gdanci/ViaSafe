package com.example.viasafe.model;

public class IncidentReport {

    public enum VerificationStatus {
        SINGLE_REPORT,
        VERIFIED
    }

    public String id;
    public String title;
    public String description;
    public String category;
    public String timeLabel;
    public String locationLabel;
    public double latitude;
    public double longitude;
    public boolean anonymous;
    public int upvotes;
    public VerificationStatus verificationStatus;

    public IncidentReport() {
        // Needed for JSON deserialization
    }

    public IncidentReport(
            String id,
            String title,
            String description,
            String category,
            String timeLabel,
            String locationLabel,
            double latitude,
            double longitude,
            boolean anonymous,
            int upvotes,
            VerificationStatus verificationStatus
    ) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.category = category;
        this.timeLabel = timeLabel;
        this.locationLabel = locationLabel;
        this.latitude = latitude;
        this.longitude = longitude;
        this.anonymous = anonymous;
        this.upvotes = upvotes;
        this.verificationStatus = verificationStatus;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public String getTimeLabel() {
        return timeLabel;
    }

    public String getLocationLabel() {
        return locationLabel;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public boolean isAnonymous() {
        return anonymous;
    }

    public int getUpvotes() {
        return upvotes;
    }

    public void incrementUpvotes() {
        upvotes++;
    }

    public VerificationStatus getVerificationStatus() {
        return verificationStatus;
    }
}

