package com.example.viasafe.network;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {

    // For Android emulator use 10.0.2.2 to reach your PC localhost.
    // Change to your cloud URL when deployed.
    private static final String BASE_URL = "http://10.0.2.2:8080/api/";
    private static final String USER_ID = "demo-user";

    private static Retrofit retrofit;
    private static OkHttpClient httpClient;

    public static Retrofit getRetrofit() {
        if (retrofit == null) {
            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(getHttpClient())
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit;
    }

    public static ApiService getApiService() {
        return getRetrofit().create(ApiService.class);
    }

    public static OkHttpClient getHttpClient() {
        if (httpClient == null) {
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BASIC);

            httpClient = new OkHttpClient.Builder()
                    .addInterceptor(logging)
                    .addInterceptor(chain -> {
                        Request original = chain.request();
                        Request request = original.newBuilder()
                                .addHeader("X-User-Id", USER_ID)
                                .build();
                        return chain.proceed(request);
                    })
                    .build();
        }
        return httpClient;
    }

    public static String getUserId() {
        return USER_ID;
    }
}

