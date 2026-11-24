# GOZIE LIVE API

Cloudflare Worker API for host authentication, session management, separated camera/viewer access, LiveKit room creation, Egress/Ingress orchestration, production-command state, R2 assets, recordings, and seven-day retention cleanup.

## Provisioning order

1. Create a Supabase project. Apply SQL migrations in order: `0001_initial.sql`, `0002_production_and_security.sql`, `0003_production_engine.sql`, then `0004_contributor_capacity.sql`.
2. Create a LiveKit Cloud project. Copy its WebSocket URL, API key, and API secret. LiveKit Cloud provides Egress and Ingress; self-hosted installations must separately deploy those services.
3. Create an R2 S3 API key that can write objects to the private `gozie-live-media` bucket. Set the endpoint to `https://<cloudflare-account-id>.r2.cloudflarestorage.com`.
4. Deploy the frontend to GitHub Pages. The API Worker's public CORS origin and `APP_BASE_PATH` are configured in `wrangler.toml` for the Pages project URL.
5. Set Worker secrets with Wrangler. Do not put server secrets in the frontend's `VITE_*` variables.
6. Deploy the API Worker with `npm run deploy:api`.

## Worker secrets

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `ENGINE_SHARED_SECRET`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT` (required for MP4 recording; live output can start without the R2 S3 credentials, but recording will be disabled)

The Worker uses non-secret `APP_ORIGIN` and `APP_BASE_PATH` values in `wrangler.toml`. The public origin is used for strict CORS; the base path keeps camera/viewer invitation links and the Egress template inside the GitHub Pages project path.

The Worker binds to the already provisioned private R2 bucket `gozie-live-media`. No R2 bucket is public.

## Broadcast engine flow

1. The host's authenticated `POST /v1/sessions/:id/start` endpoint ensures the contributor room exists.
2. It creates RTMP Ingress into a separate programme room.
3. It starts LiveKit composite Egress with the custom template at the deployed web origin. LiveKit appends the room URL and recorder token as query parameters.
4. The template subscribes to contributor camera/audio tracks, renders the selected camera or selected image/video asset, applies contributor mute state, and polls the production command queue.
5. Egress sends the rendered programme to the programme-room RTMP ingress and can also write an MP4 to R2 when the S3 credentials are configured.
6. Viewers receive subscribe-only tokens for the programme room; they never join the contributor room.
7. On session end, the API stops Egress and registers a confirmed R2 recording with expiry at session end plus seven days. The hourly cleanup job deletes expired R2 objects.

The custom template must log `START_RECORDING` after it is ready and `END_RECORDING` when it is shutting down. Test the template with the LiveKit CLI before production.

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
