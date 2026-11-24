# GOZIE LIVE acceptance tests

## Cloudflare account and website
- Production Worker responds to `GET /health`.
- `/gozie-live/` serves the built application rather than the GitHub repository README.
- D1 and R2 bindings are visible to the Worker.
- No Supabase or LiveKit packages or secrets are needed.

## Accounts and sessions
- Host can register only when Cloudflare Email Service sending is configured.
- Six-digit email verification expires, rate limits attempts and cannot be replayed.
- Verified host can sign in/out and create/schedule sessions.
- Contributor and viewer links are different and cannot cross roles.

## Camera and programme
- Contributor phone can publish camera and microphone to Cloudflare Realtime SFU.
- Host receives previews and can page through camera feeds.
- Unauthorized participants cannot subscribe to contributor tracks.
- Selected source and audio mute commands are applied by the server-side compositor.
- All viewers see one final programme output.

## Assets and recordings
- Image/video/audio uploads are private in R2.
- Media source changes work in the programme output.
- Final programme recording is stored in private R2 and is downloadable by authorized users.
- Recording/object copies expire seven days after session end.

## Load and recovery
- Test 1, 5, 20, 50, 100, 150, then 200 camera publishers.
- Record join success, connection time, preview readiness, source-to-preview latency, bitrate, packet loss, CPU/memory, audio quality, reconnect behavior and recording continuity.
- Test viewer concurrency separately.
- Browser closure on host does not stop the compositor.
- Repeat after network drops and worker/container restarts.

The platform is not accepted as production-ready until all applicable checks are run on a deployed account and real devices.
