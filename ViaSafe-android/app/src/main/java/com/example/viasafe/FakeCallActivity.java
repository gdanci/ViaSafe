package com.example.viasafe;

import android.media.MediaRecorder;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.example.viasafe.network.ApiClient;
import com.example.viasafe.network.ApiService;
import com.example.viasafe.network.model.FakeCallResponse;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class FakeCallActivity extends AppCompatActivity {

    private TextView statusText;
    private Button acceptButton;
    private Button declineButton;
    private MediaRecorder recorder;
    private File outputFile;
    private String uploadUrl;
    private boolean recording;
    private ApiService api;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_fake_call);

        statusText = findViewById(R.id.textStatus);
        acceptButton = findViewById(R.id.btnAccept);
        declineButton = findViewById(R.id.btnDecline);
        api = ApiClient.getApiService();

        statusText.setText("Incoming ViaSafe check-in call");

        acceptButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onAcceptCall();
            }
        });

        declineButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopRecording();
                finish();
            }
        });
    }

    private void onAcceptCall() {
        if (recording) return;
        acceptButton.setEnabled(false);
        declineButton.setText("End");
        statusText.setText("Starting secure recording...");

        api.startFakeCall().enqueue(new Callback<FakeCallResponse>() {
            @Override
            public void onResponse(Call<FakeCallResponse> call, Response<FakeCallResponse> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    Toast.makeText(FakeCallActivity.this, "Could not start fake call.", Toast.LENGTH_SHORT).show();
                    return;
                }
                uploadUrl = response.body().uploadUrl;
                startRecording();
            }

            @Override
            public void onFailure(Call<FakeCallResponse> call, Throwable t) {
                Toast.makeText(FakeCallActivity.this, "Could not start fake call.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void startRecording() {
        try {
            File dir = new File(getCacheDir(), "sos");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            outputFile = new File(dir, "viasafe_call_" + timestamp + ".m4a");

            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            recording = true;
            statusText.setText("Recording... stay on the call.");
        } catch (Exception e) {
            statusText.setText("Recording failed.");
            Toast.makeText(this, "Recording failed.", Toast.LENGTH_SHORT).show();
        }
    }

    private void stopRecording() {
        if (!recording || recorder == null) return;
        try {
            recorder.stop();
        } catch (Exception ignored) {
        }
        recorder.release();
        recorder = null;
        recording = false;
        statusText.setText("Recording saved. Uploading...");
        uploadRecording();
    }

    private void uploadRecording() {
        if (uploadUrl == null || outputFile == null) return;
        OkHttpClient client = ApiClient.getHttpClient();
        MediaType mediaType = MediaType.parse("audio/m4a");
        RequestBody fileBody = RequestBody.create(outputFile, mediaType);
        MultipartBody body = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("audio", outputFile.getName(), fileBody)
                .build();

        Request request = new Request.Builder()
                .url(uploadUrl)
                .post(body)
                .addHeader("X-User-Id", ApiClient.getUserId())
                .build();

        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, java.io.IOException e) {
                runOnUiThread(() -> statusText.setText("Upload failed. Saved locally."));
            }

            @Override
            public void onResponse(okhttp3.Call call, okhttp3.Response response) {
                runOnUiThread(() -> statusText.setText("Recording uploaded."));
                response.close();
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRecording();
        SosManager.getInstance(this).stopSos(this);
    }
}

