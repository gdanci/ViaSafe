package com.example.viasafe.model;

import java.util.List;

public class RouteResponse {
    public Trip trip;
    public String warning;
    public String message;

    public static class Trip {
        public List<Leg> legs;
    }

    public static class Leg {
        public String shape;
    }
}
