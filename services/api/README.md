# GOZIE LIVE Cloudflare Worker API

This is the application API Worker. The current production target uses Cloudflare D1, Durable Objects, Realtime SFU and private R2. Supabase and LiveKit are not used.

## Bound resources

- `DB`: D1 database `gozie-live-db`.
- `SESSION_ROOMS`: one Durable Object per broadcast session.
- `MEDIA_BUCKET`: private R2 bucket `gozie-live-media`.
- Cloudflare Realtime SFU app credentials: `REALTIME_SFU_APP_ID` and secret `REALTIME_SFU_APP_SECRET`.
- `AUTH_SIGNING_SECRET`: server-only secret used for verification-code digests.

## Current routes

- `GET /health`
- `POST /v1/auth/register`, `/verify`, `/login`, `/logout`
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

## Secrets and variables

Use Wrangler secrets or the Cloudflare dashboard. Never commit their values.

- `REALTIME_SFU_APP_SECRET` — created by the Cloudflare Realtime SFU application.
- `AUTH_SIGNING_SECRET` — a high-entropy random secret.
- `REALTIME_SFU_APP_ID` — non-secret ID (configured as a Worker variable).
- `APP_ORIGIN`, `APP_BASE_PATH` — configured in `wrangler.toml`.

## Email verification

Host registration requires Cloudflare Email Service. The account currently has no verified sending domain, so register intentionally returns a configuration error until an eligible sending domain is onboarded and the Worker receives an `EMAIL` binding and `EMAIL_FROM` variable.

## Media path

Contributor browsers publish WebRTC tracks through Cloudflare Realtime SFU. Admin preview subscriptions are limited to 12 cameras at a time. The host UI is a control surface. The independent server-side programme compositor, final viewer output, audio mixing, and MP4 recording are not yet deployed. Current API responses do not pretend those functions are active.

## Recording cleanup

The Worker cron runs hourly and removes recording objects whose `expires_at` timestamp has passed. The required expiry is session end plus seven days. No generic bucket lifecycle rule is used.
