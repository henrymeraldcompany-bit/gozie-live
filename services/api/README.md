# GOZIE LIVE API

Cloudflare Worker API for authenticated session management, separate contributor/viewer admission, short-lived LiveKit tokens, R2 asset uploads, production command queuing, viewer presence, recording metadata, and scheduled retention cleanup.

## Local setup

1. Apply database migrations in order: `database/migrations/0001_initial.sql`, then `0002_production_and_security.sql`.
2. Create a Supabase project and obtain its URL, anon/publishable key, and service-role key.
3. Provision the LiveKit project and copy its WebSocket URL, API key, and API secret.
4. Set Worker secrets with `wrangler secret put`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `APP_ORIGIN`, and `ENGINE_SHARED_SECRET`.
5. Run `npm run dev --workspace @gozie-live/api`. Deploy with `npm run deploy --workspace @gozie-live/api`.

The Worker binds to the already provisioned private R2 bucket `gozie-live-media`. Deploy only after the database and secrets exist.

## Important safety boundaries

- Supabase Auth verifies admin identity. Owner endpoints compare the session owner ID server-side.
- Contributor JWTs can publish but cannot subscribe. Viewer JWTs can subscribe but cannot publish, and join a separate programme room.
- The programme room must be published by the independent production engine. The admin browser is never the programme source of truth.
- Production control commands are stored as pending. Until a media-engine consumer is deployed, responses explicitly report `applied: false`.
- Viewer presence expires automatically after 60 seconds without a heartbeat.
- A recording expires seven days after the session's recorded end time. The hourly scheduled job deletes its R2 object and then marks its database row deleted.
- Initial browser upload limit is 100 MB. Larger video uploads need a multipart/direct-to-R2 flow.

## Routes

- `GET /health`
- `GET, POST /v1/sessions`
- `GET /v1/sessions/:id`
- `POST /v1/sessions/:id/owner-tokens`
- `POST /v1/sessions/:id/start`, `/end`, `/production`
- `POST /v1/sessions/:id/assets`, `GET /v1/sessions/:id/assets/:assetId/file`
- `POST /v1/join/contributor`, `POST /v1/join/viewer`
- `POST /v1/viewer/heartbeat`
- `POST /v1/internal/recordings` (engine secret required)
- `GET /v1/public/recordings/:id?code=...`

Database access uses the Supabase REST API with a server-only service-role key after verifying user identity. Do not expose that key to the browser.
