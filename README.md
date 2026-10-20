# ViaSafe

**Safer routes for women, day and night** — built for the **GDGoCode Hackathon**.

ViaSafe helps people navigate **Cluj-Napoca** with awareness of reported risks, community incident pins, and pedestrian routes that steer away from active danger markers. The project includes a **web map**, an **Android app**, and a **Node.js API** backed by Firebase and optional [Valhalla](https://github.com/valhalla/valhalla) routing.

**Live demo:** [https://viasafe-ne2czrd3hq-ew.a.run.app/](https://viasafe-ne2czrd3hq-ew.a.run.app/)

> **Not for emergencies.** ViaSafe is a community safety tool. If you are in immediate danger, call **112** (or your local emergency number).

---

## Features

| Area | What it does |
|------|----------------|
| **Safety map** | Color-coded risk zones for Cluj-Napoca, plus live community reports on the map |
| **Safer routes** | Pedestrian routing that avoids recent pinpoint reports (when Valhalla is configured) |
| **Reports & feed** | Submit incidents (harassment, poor lighting, isolated areas, suspicious groups), browse nearby reports, upvote helpful pins |
| **Safe havens** | Quick paths to hospitals, police stations, 24/7 pharmacies, and trusted late-night spots |
| **SOS & trusted contacts** | Share live location with contacts via share links and WebSocket streaming *(local / demo API only until real auth)* |
| **Fake call** | Discreet “incoming call” screen to exit uncomfortable situations *(same auth caveat)* |
| **Night mode** | Map styling tuned for evening use |

---

## Tech stack

**Backend & web**

- Node.js, Express, TypeScript  
- Firebase (Firestore, Storage), optional Google Cloud Storage  
- Valhalla for pedestrian routing  
- WebSockets for SOS live location  
- Static web app (`viasafe-backend/public/`) with Leaflet  

**Android**

- Java, Material Design, Retrofit, OkHttp  
- Google Maps & Location Services  
- Firebase (Firestore, Realtime Database, Storage)  

---

## Hackathon context

ViaSafe was created during the **GDGoCode Hackathon** as a practical response to street safety: combining **maps**, **crowdsourced reports**, and **routing** so people can make informed choices about where and how they walk — especially at night.

We focused on **Cluj-Napoca** as a pilot city with seeded risk data and neighborhood-aware UX, with room to expand once authentication and moderation mature.

