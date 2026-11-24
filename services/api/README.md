# GOZIE LIVE API

Cloudflare Worker API for host authentication, session management, separated camera/viewer access, LiveKit room creation, Egress/Ingress orchestration, production-command state, R2 assets, recordings, and seven-day retention cleanup.

## Provisioning order

1. Create a Supabase project. Apply SQL migrations in order: `0001_initial.sql`, `0002_production_and_security.sql`, then `0003_production_engine.sql`.
2. Create a LiveKit Cloud project. Copy its WebSocket URL, API key, and API secret. LiveKit Cloud provides Egress and Ingress; self-hosted installations must separately deploy those services.
3. Create an R2 S3 API key that can write objects to the private `gozie-live-media` bucket. Set the endpoint to `https://<cloudflare-account-id>.r2.cloudflarestorage.com`.
4. Deploy the frontend and note its public origin. Set the Worker secrets below.
5. Run `npm run deploy:api` from the repository root after authentication with Wrangler.

## Worker secrets

Set each value with Wrangler; do not place server secrets in the frontend's `VITE_*` variables.

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `APP_ORIGIN` (the deployed web app origin, required for share links and the Egress template)
- `ENGINE_SHARED_SECRET` (reserved for trusted internal callbacks)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT` (required for MP4 recording; live output can start without the R2 S3 credentials, but recording will be disabled)

The Worker binds to the already provisioned private R2 bucket `gozie-live-media`. No R2 bucket is public.

## Broadcast engine flow

1. The host's authenticated `POST /v1/sessions/:id/start` endpoint ensures the contributor room exists.
2. It creates RTMP Ingress into a separate programme room.
3. It starts a LiveKit composite Egress with the custom template at the deployed web origin. LiveKit opens the template in its server-managed browser and provides the room URL/token through query parameters.
4. The template subscribes to contributor camera/audio tracks, renders the selected camera or selected image/video asset, applies contributor mute state, and polls the production command queue.
5. Egress sends the rendered programme to the programme-room RTMP ingress. It can also write an MP4 simultaneously to R2 when the S3 credentials are configured.
6. Viewers receive subscribe-only tokens for the programme room; they never join the contributor room.
7. On session end, the API stops Egress and registers a confirmed R2 recording with expiry at session end plus seven days. The hourly cleanup job deletes expired R2 objects.

LiveKit documents custom room-composite templates, RTMP stream outputs, and S3-compatible output including Cloudflare R2. This repository's integration is not considered production-verified until a real LiveKit project, R2 S3 credentials, deployed template, and end-to-end stream/recording test are completed.

## Security boundaries

- Supabase Auth verifies host identity. Session owner IDs are checked server-side.
- Contributor tokens can publish but cannot subscribe. Viewer tokens can subscribe but cannot publish, and join only the programme room.
- Egress access uses a high-entropy control code stored as a SHA-256 hash. The browser renderer receives no Supabase service key or LiveKit API secret.
- Service-role keys and LiveKit credentials exist only as Worker secrets.
- Production commands are atomically claimed by the SQL function `claim_production_commands`, then validated and applied to server-renderer state.

## Main routes

- `GET /health`
- `GET, POST /v1/sessions`
- `GET /v1/sessions/:id`
- `POST /v1/sessions/:id/owner-tokens`
- `POST /v1/sessions/:id/start`, `/end`, `/production`, `/share-links`
- `POST /v1/sessions/:id/assets`, `GET /v1/sessions/:id/assets/:assetId/file`
- `POST /v1/join/contributor`, `POST /v1/join/viewer`
- `POST /v1/viewer/heartbeat`
- `GET /v1/public/engine/state`, `GET /v1/public/engine/assets/:assetId` (high-entropy renderer code required)
- `GET /v1/public/session`, `GET /v1/public/recordings/:id`

Initial browser uploads are limited to 100 MB. Larger uploads require a multipart/direct-to-R2 flow.
