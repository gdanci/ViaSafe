package com.example.viasafe.network;

import com.example.viasafe.model.IncidentReport;
import com.example.viasafe.model.RiskArea;
import com.example.viasafe.model.RouteResponse;
import com.example.viasafe.network.model.ContactCreateRequest;
import com.example.viasafe.network.model.ContactResponse;
import com.example.viasafe.network.model.ContactsResponse;
import com.example.viasafe.network.model.FakeCallResponse;
import com.example.viasafe.network.model.SosStartResponse;
import com.example.viasafe.network.model.SosStopResponse;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.DELETE;
import retrofit2.http.PUT;

public interface ApiService {

    // Base AI-generated risk map for Cluj-Napoca
    @GET("risk-map")
    Call<List<RiskArea>> getRiskMap();

    // User reports for feed and map
    @GET("reports")
    Call<List<IncidentReport>> getReports();

    @POST("reports")
    Call<Void> submitReport(@Body Map<String, Object> body);

    @POST("reports/{id}/upvote")
    Call<Void> upvoteReport(@Path("id") String id);

    // Alternate safe route powered by Valhalla / shortest-path backend
    @POST("routes/safe")
    Call<RouteResponse> getSafeRoute(@Body Map<String, Object> body);

    // SOS / fake call backend
    @POST("sos/start")
    Call<SosStartResponse> startSos(@Body Map<String, Object> body);

    @POST("sos/stop")
    Call<SosStopResponse> stopSos();

    @POST("call/fake")
    Call<FakeCallResponse> startFakeCall();

    // Contacts
    @GET("contacts")
    Call<ContactsResponse> getContacts();

    @POST("contacts")
    Call<ContactResponse> createContact(@Body ContactCreateRequest request);

    @PUT("contacts/{id}")
    Call<ContactResponse> updateContact(@Path("id") String id, @Body ContactCreateRequest request);

    @DELETE("contacts/{id}")
    Call<Void> deleteContact(@Path("id") String id);
}

