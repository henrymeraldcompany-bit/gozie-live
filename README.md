# GOZIE LIVE

GOZIE LIVE is a multi-camera live-streaming and broadcast-production application.

## Website deployment

The production website is built from `apps/web` and published by the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`. It is not the repository README.

GitHub Pages project URL: https://henrymeraldcompany-bit.github.io/gozie-live/

The Pages build uses the repository's nested `/gozie-live/` base path. The workflow reads these repository Actions variables when they are configured:

- `GOZIE_LIVE_API_URL` — deployed API Worker URL, including `https://`.
- `GOZIE_LIVE_SUPABASE_URL` — Supabase project URL.
- `GOZIE_LIVE_SUPABASE_ANON_KEY` — Supabase publishable/anon key.

These are public frontend configuration values, not secrets. Never put a Supabase service-role key, LiveKit API secret, or R2 S3 secret in a `VITE_*` variable or GitHub Pages build variable.

## Current application features

- Admin Studio, Camera Studio, Viewer, and server-managed LiveKit Egress template.
- Host authentication and owner-scoped session API foundations.
- Separate contributor and viewer access grants.
- Camera monitor, programme preview, source selection, mute controls, and media uploads.
- Private R2 storage integration and seven-day recording retention logic.
- API-side contributor slot ceiling of 200 active cameras.

## Backend setup still required

The frontend can be hosted independently, but working sign-in and live streaming require a Supabase project, LiveKit Cloud project with Ingress/Egress, API Worker secrets, and an API deployment. The private R2 bucket `gozie-live-media` has been provisioned; its S3 credentials still need to be configured for MP4 recording.

See [deployment plan](docs/deployment/plan.md) and [API setup](services/api/README.md).

## Local development

Requirements: Node.js 22.22+ and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

For local development, configure `VITE_BASE_PATH=/`, `VITE_API_BASE_URL`, and the Supabase public URL/key in `.env`.
