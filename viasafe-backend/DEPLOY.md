# Putting ViaSafe online (Google Cloud Run)

One command, from this folder in PowerShell:

    .\deploy-cloudrun.ps1

It will, in order: sign you in to Google Cloud, check billing, copy the Cluj map tiles from your local
`valhalla` container, deploy the private routing service (`viasafe-valhalla`) and then the public
website + API (`viasafe`). At the end it prints the public link.

## What is different on the public server

| Setting | Value online | Why |
|---|---|---|
| `ENABLE_PRIVATE_API` | `false` | Contacts, SOS, fake call and live location only identify people by an `x-user-id` header anyone can forge. They stay off until real sign-in exists. (Locally and for the Android emulator they stay on.) |
| `ALLOW_RESET` | `false` | `?reset=1` wipes the demo data; nobody on the internet should be able to do that. |
| `SEED_DEMO_DATA` | `false` | Stops the server from deleting and re-seeding data when the database is small. |
| `CLUJ_ONLY` | `true` | Reports and routes outside Cluj-Napoca are refused. |

Also on by default: rate limits (10 reports / 40 routes per 10 minutes per visitor), 50 KB request limit,
field length limits, and no secret key inside the online image (it uses the Cloud Run service identity).

## Updating later
Change the code, then run `.\deploy-cloudrun.ps1` again.

## Stopping it / cost
Both services scale to zero when nobody uses them. To switch the site off:

    gcloud run services delete viasafe --region europe-west1
    gcloud run services delete viasafe-valhalla --region europe-west1
