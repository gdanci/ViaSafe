package com.example.viasafe;

import android.app.AlertDialog;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.example.viasafe.network.ApiClient;
import com.example.viasafe.network.ApiService;
import com.example.viasafe.network.model.Contact;
import com.example.viasafe.network.model.ContactCreateRequest;
import com.example.viasafe.network.model.ContactResponse;
import com.example.viasafe.network.model.ContactsResponse;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private LinearLayout contactList;
    private ApiService api;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_profile, container, false);
        contactList = root.findViewById(R.id.contactList);
        Button btnAddContact = root.findViewById(R.id.btnAddContact);
        api = ApiClient.getApiService();

        btnAddContact.setOnClickListener(v -> showAddContactDialog());
        loadContacts();
        return root;
    }

    private void loadContacts() {
        if (getContext() == null) return;
        api.getContacts().enqueue(new Callback<ContactsResponse>() {
            @Override
            public void onResponse(Call<ContactsResponse> call, Response<ContactsResponse> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    showEmptyState("Could not load contacts.");
                    return;
                }
                List<Contact> contacts = response.body().contacts;
                contactList.removeAllViews();
                if (contacts == null || contacts.isEmpty()) {
                    showEmptyState("No trusted contacts yet.");
                    return;
                }
                for (Contact contact : contacts) {
                    addContactRow(contact);
                }
            }

            @Override
            public void onFailure(Call<ContactsResponse> call, Throwable t) {
                showEmptyState("Could not load contacts.");
            }
        });
    }

    private void showEmptyState(String message) {
        contactList.removeAllViews();
        TextView empty = new TextView(getContext());
        empty.setText(message);
        contactList.addView(empty);
    }

    private void addContactRow(Contact contact) {
        if (getContext() == null) return;
        LinearLayout row = new LinearLayout(getContext());
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, 8, 0, 8);

        TextView name = new TextView(getContext());
        name.setText(contact.label);
        name.setTextSize(16f);
        row.addView(name);

        if (!TextUtils.isEmpty(contact.phoneOrEmail)) {
            TextView meta = new TextView(getContext());
            meta.setText(contact.phoneOrEmail);
            row.addView(meta);
        }

        Button remove = new Button(getContext());
        remove.setText("Remove");
        remove.setOnClickListener(v -> deleteContact(contact.id));
        row.addView(remove);

        contactList.addView(row);
    }

    private void showAddContactDialog() {
        if (getContext() == null) return;
        LinearLayout wrapper = new LinearLayout(getContext());
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setPadding(32, 16, 32, 0);

        EditText nameInput = new EditText(getContext());
        nameInput.setHint("Name");
        wrapper.addView(nameInput);

        EditText phoneInput = new EditText(getContext());
        phoneInput.setHint("Phone or email");
        wrapper.addView(phoneInput);

        new AlertDialog.Builder(getContext())
                .setTitle("Add trusted contact")
                .setView(wrapper)
                .setPositiveButton("Add", (dialog, which) -> {
                    String name = nameInput.getText().toString().trim();
                    String phone = phoneInput.getText().toString().trim();
                    if (TextUtils.isEmpty(name)) {
                        Toast.makeText(getContext(), "Name is required.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    createContact(name, phone);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void createContact(String name, String phone) {
        api.createContact(new ContactCreateRequest(name, phone, null))
                .enqueue(new Callback<ContactResponse>() {
                    @Override
                    public void onResponse(Call<ContactResponse> call, Response<ContactResponse> response) {
                        if (response.isSuccessful()) {
                            loadContacts();
                        } else {
                            Toast.makeText(getContext(), "Could not add contact.", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<ContactResponse> call, Throwable t) {
                        Toast.makeText(getContext(), "Could not add contact.", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void deleteContact(String id) {
        api.deleteContact(id).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> response) {
                loadContacts();
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                Toast.makeText(getContext(), "Could not remove contact.", Toast.LENGTH_SHORT).show();
            }
        });
    }
}

