# GOZIE LIVE Cloudflare deployment

## Cloudflare-only production stack

- **Workers + Workers Static Assets:** one origin for the SPA and API.
- **D1:** host accounts, sessions, contributor records, presence and recording metadata.
- **Durable Objects:** per-session camera slot admission and liveness.
- **Realtime SFU:** browser camera and microphone publishing plus host preview subscriptions.
- **R2:** private assets and programme recordings.
- **Cron Trigger:** hourly recording expiration and session cleanup.
- **Containers:** planned independent programme compositor for final video/audio mixing; not yet deployed.
- **Stream:** candidate delivery path for a final programme after the compositor is ready.

## Provisioned resources

- Account: dedicated Live Stream Cloudflare account.
- Workers subdomain: `gozielive.workers.dev`.
- D1: `gozie-live-db`, APAC, ID `67f8680e-5c19-4cc6-b082-65d12dc7846a`.
- R2: private bucket `gozie-live-media`.
- Realtime SFU app: `GOZIE LIVE production media`, ID `a15d31f644b96a0376362c254686ea40`.

## Implemented in repository

- React Admin, Camera and Viewer interfaces.
- Cloudflare D1-backed API routes for account registration, verification, login, sessions, contributor admission, uploads, shares and recordings metadata.
- Password hashing using PBKDF2 and opaque, database-backed HttpOnly session cookies.
- Per-session Durable Object admission limit of 200 contributors with presence expiry.
- Cloudflare Realtime SFU WebRTC publishing and host subscription negotiation.
- Private R2 uploads for image, video and audio assets.
- Recording expiration scheduler based on the session end timestamp plus seven days.

## Remaining production gaps

- Worker deployment and secret bindings must be completed and health checked.
- Email Sending domain is not configured in the account; registration/verification deliberately reports this rather than creating unverified host accounts.
- Cloudflare Realtime camera publishing and host preview must be tested on physical phones.
- A dedicated Cloudflare Container compositor is not yet deployed. The current API marks the camera ingest path separately and does not claim a final programme stream.
- Final programme encoding, switching, audio mix/limiting, Stream delivery and MP4 recording still need implementation and end-to-end validation.
- 200 contributors is a configured ceiling, not a demonstrated performance result. Load tests are required.

## URLs

Production target: `https://gozie-live.gozielive.workers.dev/gozie-live/`.

The repository root on GitHub is documentation and source code, not the application website.

## Secrets

Keep `REALTIME_SFU_APP_SECRET` and `AUTH_SIGNING_SECRET` as Worker secrets. Never expose them in source code, Pages variables, frontend bundles or QR links. The SFU app ID is not secret.

## Retention

Recording expiry is 7 days after session end, not seven days after upload. The scheduled Worker deletes expired R2 objects and records the deletion timestamp.

## Cost

Cloudflare-only does not mean free or unlimited. Realtime media egress, Workers, D1, R2 operations/storage, Containers and Stream delivery can incur usage charges. Check current account pricing before opening a large public session.
