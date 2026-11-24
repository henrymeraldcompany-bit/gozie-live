# GOZIE LIVE — Cloudflare-only deployment status

## Production URL

**Application:** https://gozie-live.gozielive.workers.dev/gozie-live/

The GitHub repository home page shows the README and source files by design. It is not the application. Open the Cloudflare Worker URL above to access the app interface.

## Provisioned Cloudflare resources

- Dedicated account: **Live Stream**.
- Workers subdomain: `gozielive.workers.dev`.
- Worker: `gozie-live`.
- Worker deployment ID: `44431b68e6af4bf089a609e504460553`.
- Worker subdomain access: enabled.
- D1 database: `gozie-live-db`, APAC, ID `67f8680e-5c19-4cc6-b082-65d12dc7846a`.
- R2 bucket: `gozie-live-media`, private.
- Durable Object: `SessionRoom`, SQLite-backed.
- Realtime SFU application: `GOZIE LIVE production media`, app ID `a15d31f644b96a0376362c254686ea40`.
- Hourly Cron Trigger: `0 * * * *`.

## Cloudflare-only architecture

- **Workers:** serves the web application and same-origin API.
- **D1:** host accounts, sessions, contributors, production commands and recording metadata.
- **Durable Objects:** per-session contributor admission and presence.
- **Realtime SFU:** WebRTC camera publishing and host preview subscriptions.
- **R2:** private media uploads and recording storage.
- **Cron:** removes stored recording objects after their seven-day expiry.
- **RealtimeKit or Containers:** candidate server-side programme production and streaming. Not deployed yet.

No Supabase or LiveKit integration is part of the application stack.

## Implemented and deployed

- React Admin, Camera and Viewer interfaces are bundled inside the Worker.
- D1-backed API routes for host registration, verification, login, session management and share links.
- PBKDF2 password hashing and opaque HttpOnly database-backed session cookies.
- Durable Object admission code with a maximum of 200 active contributor slots and stale-presence expiry.
- Cloudflare Realtime SFU WebRTC publish and host-preview negotiation code.
- Private R2 image/video/audio upload and authenticated asset retrieval.
- Hourly expired-recording cleanup job.
- Health endpoint reports D1, R2, Realtime SFU secret and email configuration status.

CI passed on the build that was deployed. The Worker has been accepted by Cloudflare and its `workers.dev` route is enabled. The public page and real media paths still require independent browser/device verification.

## Required secure configuration still outstanding

1. **Worker secret `REALTIME_SFU_APP_SECRET`:** must be installed through Cloudflare Worker Settings → Variables and Secrets. The value must never be placed in GitHub or the frontend.
2. **Worker secret `AUTH_SIGNING_SECRET`:** generate a unique high-entropy value and store it as a Worker secret.
3. **Email Sending:** this account currently has no DNS zone or verified sending domain. Add a domain to Cloudflare DNS, onboard it in Cloudflare Email Service, then bind the `EMAIL` sending integration and configure `EMAIL_FROM`. Until then, registration deliberately refuses to create an account that cannot be verified.
4. After setting the secrets, redeploy or restart the Worker if required by the dashboard, then test registration and camera publishing.

## Programme production not yet deployed

The current system does not yet switch camera sources into a final broadcast, mix all source audio, deliver a final programme to viewers, or produce a final-programme MP4 recording. The host dashboard labels the programme engine as unavailable. The next engineering milestone is a verified Cloudflare RealtimeKit composite/RTMP path or a Cloudflare Container compositor.

The SFU's WebSocket video adapter is snapshot-oriented and cannot be treated as a normal continuous 30 fps video feed. The programme engine must use a supported continuous media path.

## Capacity and retention

The configured 200-contributor limit is an admission ceiling, not a performance guarantee. Load testing must progress through 1, 5, 20, 50, 100, 150 and 200 camera contributors, then independently test viewers.

When recording is implemented, expiry must be calculated from session end plus seven days. The hourly cleanup job is configured, but there are no production recordings until the final-output recorder exists.

## Cost

Cloudflare-only does not mean free or unlimited. Realtime egress, RealtimeKit exports (if selected), Workers, D1, R2 storage/operations, and any Containers/Stream delivery may incur usage charges. Do not start a high-volume public broadcast until pricing and account limits are checked.
