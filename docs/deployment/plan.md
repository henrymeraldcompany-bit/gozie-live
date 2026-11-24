# Deployment plan

## Provisioned resources

- Cloudflare account: dedicated **Live Stream** connection.
- Private R2 bucket: `gozie-live-media` (APAC location hint, Standard storage).
- Bucket is not publicly exposed. No credentials or API tokens are stored in GitHub.

## Website deployment

- Frontend source: `apps/web`.
- GitHub Pages deployment workflow: `.github/workflows/deploy-pages.yml`.
- Expected website: https://henrymeraldcompany-bit.github.io/gozie-live/
- Vite is configured to use the Pages base path provided by `actions/configure-pages`.
- Set repository Actions variables `GOZIE_LIVE_API_URL`, `GOZIE_LIVE_SUPABASE_URL`, and `GOZIE_LIVE_SUPABASE_ANON_KEY` before expecting host sign-in and session management to work.
- If the Pages workflow reports that the Pages source is not configured for Actions, switch Repository Settings → Pages → Build and deployment → Source to **GitHub Actions** once.

## Implemented repository components

- React/Vite frontend with Admin Studio, Camera Studio, Viewer and Egress composition mode.
- Supabase Auth and owner-scoped Worker API.
- LiveKit contributor and programme rooms, role-scoped tokens, RTMP Ingress and composite Egress start/stop orchestration.
- Egress renderer for source selection, uploaded image/video replacement and contributor audio mute state.
- Private R2 media asset upload, optional Egress MP4 output to R2, seven-day expiry metadata and hourly deletion job.
- Database migrations for production command queue, engine state, atomic command claiming, and 200-slot active contributor admission with heartbeat expiry.

## Still requiring external setup

- Supabase project: not provisioned; apply migrations `0001` through `0004` in order.
- LiveKit Cloud project: not provisioned; Egress/Ingress path has not been exercised.
- R2 S3 API credentials: not created. The existing private bucket exists, but Egress recording is disabled until its S3 keys and endpoint are set as Worker secrets.
- Worker secrets: not configured.
- Cloudflare API Worker: not deployed.
- End-to-end broadcast, recording upload, viewer playback, and deletion test: pending.
- Capacity tests through 200 contributors and independent viewer-load tests: pending.

## Deployment sequence

1. Create/configure Supabase; apply the four SQL migrations in order.
2. Create/configure LiveKit Cloud; capture its WebSocket URL, API key and secret.
3. Create an R2 S3 API key with write access to the private bucket.
4. Add the three public frontend variables to GitHub repository Settings → Secrets and variables → Actions → Variables.
5. The Pages workflow builds and deploys the frontend automatically on pushes to `main`.
6. Set API Worker secrets: Supabase values, LiveKit values, `ENGINE_SHARED_SECRET`, and the R2 S3 values.
7. Deploy the API Worker. Confirm `GET /health` before running an end-to-end test.
8. Create a test session; verify camera publish-only permissions, Egress renderer connection, RTMP programme ingress, viewer subscribe-only permissions, MP4 upload, download, and seven-day cleanup.

## Retention behaviour

Recording expiry is calculated from each session's end time plus seven days. The hourly trusted Worker job deletes the matching R2 object and marks the DB row deleted. No blanket R2 lifecycle expiry is configured, because that would incorrectly calculate retention from upload time.

Never commit Supabase service-role keys, LiveKit secrets, R2 S3 credentials, or the engine shared secret.
