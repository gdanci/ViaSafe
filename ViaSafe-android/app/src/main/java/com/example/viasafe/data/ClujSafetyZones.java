package com.example.viasafe.data;

import com.example.viasafe.model.SafetyLevel;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public final class ClujSafetyZones {

    public static final class Zone {
        private final String name;
        private final String ratingLabel;
        private final SafetyLevel level;
        private final double latitude;
        private final double longitude;

        public Zone(String name, String ratingLabel, SafetyLevel level, double latitude, double longitude) {
            this.name = name;
            this.ratingLabel = ratingLabel;
            this.level = level;
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public String getName() {
            return name;
        }

        public String getRatingLabel() {
            return ratingLabel;
        }

        public SafetyLevel getLevel() {
            return level;
        }

        public double getLatitude() {
            return latitude;
        }

        public double getLongitude() {
            return longitude;
        }
    }

    private static final List<Zone> ZONES = Collections.unmodifiableList(Arrays.asList(
            new Zone("Sopor", "Sigur", SafetyLevel.SAFE, 46.7815, 23.6750),
            new Zone("Andrei Muresanu", "Sigur", SafetyLevel.SAFE, 46.7535, 23.5980),
            new Zone("Gheorgheni", "Sigur", SafetyLevel.SAFE, 46.7765, 23.6090),
            new Zone("Grigorescu", "Moderat bun", SafetyLevel.CAUTION, 46.7705, 23.5535),
            new Zone("Plopilor", "Moderat bun", SafetyLevel.CAUTION, 46.7755, 23.5655),
            new Zone("Zorilor", "Moderat bun", SafetyLevel.CAUTION, 46.7545, 23.5875),
            new Zone("Centru", "Moderat bun", SafetyLevel.CAUTION, 46.7712, 23.6236),
            new Zone("Gruia", "Moderat bun", SafetyLevel.CAUTION, 46.7835, 23.5900),
            new Zone("Marasti", "Moderat bun", SafetyLevel.CAUTION, 46.7810, 23.6165),
            new Zone("Intre Lacuri", "Moderat bun", SafetyLevel.CAUTION, 46.7830, 23.6485),
            new Zone("Buna Ziua", "Moderat bun", SafetyLevel.CAUTION, 46.7395, 23.5905),
            new Zone("Manastur", "Moderat bun", SafetyLevel.CAUTION, 46.7530, 23.5555),
            new Zone("Iris", "Moderat bun", SafetyLevel.CAUTION, 46.8010, 23.6200),
            new Zone("Bulgaria", "Moderat", SafetyLevel.WARNING, 46.7930, 23.6370),
            new Zone("Borhanci", "Moderat", SafetyLevel.WARNING, 46.7425, 23.6225),
            new Zone("Someseni", "Moderat", SafetyLevel.WARNING, 46.7835, 23.6650),
            new Zone("Dambul Rotund", "Moderat", SafetyLevel.WARNING, 46.7935, 23.5650),
            new Zone("Faget", "Moderat", SafetyLevel.WARNING, 46.7225, 23.5860),
            new Zone("Europa", "Nesigur", SafetyLevel.DANGER, 46.7420, 23.5715),
            new Zone("Becas", "Nesigur", SafetyLevel.DANGER, 46.7385, 23.6105)
    ));

    private ClujSafetyZones() {
    }

    public static List<Zone> getZones() {
        return ZONES;
    }
}
