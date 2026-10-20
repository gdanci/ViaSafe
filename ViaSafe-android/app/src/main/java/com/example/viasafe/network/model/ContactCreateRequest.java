package com.example.viasafe.network.model;

public class ContactCreateRequest {
    public String label;
    public String phoneOrEmail;
    public String fcmToken;

    public ContactCreateRequest(String label, String phoneOrEmail, String fcmToken) {
        this.label = label;
        this.phoneOrEmail = phoneOrEmail;
        this.fcmToken = fcmToken;
    }
}
