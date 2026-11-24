# GOZIE LIVE — Cloudflare-only deployment status

## Production URL

**Application:** https://gozie-live.gozielive.workers.dev/gozie-live/

The GitHub repository home page displays the README and source code. It is not the application website. Open the Cloudflare Worker URL above.

## Provisioned Cloudflare resources

- Dedicated account: **Live Stream**.
- Workers subdomain: `gozielive.workers.dev`.
- Worker: `gozie-live`.
- Latest deployed Worker deployment ID: `83e65df817014bfbbd0d858f62963cee`.
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

## Implemented and deployed foundations

- React Admin, Camera and Viewer interfaces are bundled inside the Worker.
- D1-backed password registration/login, session management and share links.
- PBKDF2 password hashing and opaque HttpOnly database-backed session cookies.
- Per-session Durable Object admission code with a maximum of 200 active contributor slots and stale-presence expiry.
- Cloudflare Realtime SFU WebRTC publishing and host-preview negotiation code.
- Private R2 image/video/audio upload and authenticated asset retrieval.
- Hourly expired-recording cleanup job.
- Health endpoint reports D1, R2 and Realtime SFU configuration status.

Host registration does not require email sending or a separate domain. Password recovery is not implemented yet, so hosts should keep their password safe.

The latest source revision passed CI: dependency installation, TypeScript checks, frontend production build, asset bundling, Worker compilation, deployment artifact packaging and Worker configuration dry-run. That tested build was deployed as Worker deployment `83e65df817014bfbbd0d858f62963cee`. The public page and actual media paths still need browser/device verification.

## Required secure configuration still outstanding

1. **Worker secret `REALTIME_SFU_APP_SECRET`:** install it through Cloudflare Dashboard → Workers & Pages → `gozie-live` → Settings → Variables and Secrets → Add secret. Use the secret belonging to the Realtime SFU application. Do not put it in GitHub, chat, or frontend variables.
2. Once the secret is set, verify `GET /health` reports the Realtime SFU as configured, then test a camera phone and the host preview.

## Programme production not yet deployed

The current system does not yet switch camera sources into a final broadcast, mix all source audio, deliver a final programme to viewers, or produce a final-programme MP4 recording. The host dashboard labels the programme engine as unavailable. The next engineering milestone is a verified Cloudflare RealtimeKit composite/RTMP path or a Cloudflare Container compositor.

The SFU's WebSocket video adapter is snapshot-oriented and cannot be treated as a normal continuous 30 fps video feed. The programme engine must use a supported continuous media path.

## Capacity and retention

The configured 200-contributor limit is an admission ceiling, not a performance guarantee. Load testing must progress through 1, 5, 20, 50, 100, 150 and 200 camera contributors, then independently test viewers.

When recording is implemented, expiry must be calculated from session end plus seven days. The hourly cleanup job is configured, but there are no final-programme recordings until the compositor and recorder exist.

## Cost

Cloudflare-only does not mean free or unlimited. Realtime egress, RealtimeKit exports (if selected), Workers, D1, R2 storage/operations, and any Containers/Stream delivery may incur usage charges. Do not start a high-volume public session until pricing and account limits are checked.
