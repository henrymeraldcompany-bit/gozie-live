# GOZIE LIVE Cloudflare Worker API

The application API runs on Cloudflare Workers with D1, Durable Objects, Realtime SFU and private R2. Supabase and LiveKit are not used.

## Bound resources

- `DB`: D1 database `gozie-live-db`.
- `SESSION_ROOMS`: one Durable Object per broadcast session.
- `MEDIA_BUCKET`: private R2 bucket `gozie-live-media`.
- `REALTIME_SFU_APP_ID`: non-secret Cloudflare Realtime SFU application ID.
- `REALTIME_SFU_APP_SECRET`: Worker secret required for media publishing and subscriptions.
- `APP_ORIGIN`, `APP_BASE_PATH`: public application URL settings.

## Routes

- `GET /health`
- `POST /v1/auth/register`, `/login`, `/logout`
- `GET /v1/auth/session`
- `GET, POST /v1/sessions`
- `GET /v1/sessions/:id`
- `POST /v1/sessions/:id/share-links`, `/start`, `/end`, `/production`, `/assets`
- `POST /v1/join/contributor`
- `POST /v1/contributors/presence`
- `POST /v1/media/publish`
- `POST /v1/sessions/:id/subscribe`
- `POST /v1/media/renegotiate`
- `GET /v1/public/session`
- `GET /v1/recordings/download`

## Host authentication

Host accounts are registered in D1 using PBKDF2 password hashing. The API issues opaque random session cookies marked HttpOnly, Secure and SameSite=Lax; only a hash of the cookie token is stored in D1. Host registration does not depend on a DNS zone or an email-sending provider. Password-reset/recovery is not implemented in this release.

## Secret configuration

Set `REALTIME_SFU_APP_SECRET` through Cloudflare Dashboard → Workers & Pages → `gozie-live` → Settings → Variables and Secrets. Never commit the secret or expose it in the browser.

## Media path and current boundary

Contributor browsers are intended to publish WebRTC tracks through Cloudflare Realtime SFU. Admin preview subscriptions are limited to 12 cameras at a time. The independent server-side programme compositor, final viewer output, audio mixing, and MP4 recording are not yet deployed; the application must not claim those functions are active.

## Recording cleanup

The Worker cron runs hourly and removes recording objects whose `expires_at` timestamp has passed. The planned expiry is session end plus seven days. No generic bucket lifecycle rule is used.
