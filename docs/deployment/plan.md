# Deployment plan — Cloudflare-only architecture

## Cloudflare account and provisioned resources

All production infrastructure for GOZIE LIVE is intended to remain within the dedicated Cloudflare **Live Stream** account. Supabase and LiveKit are not part of the target architecture.

- Cloudflare account: dedicated **Live Stream** connection.
- Private R2 bucket: `gozie-live-media` (APAC location hint, Standard storage).
- D1 database: `gozie-live-db` (created in APAC; ID `67f8680e-5c19-4cc6-b082-65d12dc7846a`).
- D1 schema: `database/cloudflare-d1/0001_initial.sql` committed and applied successfully.
- Existing GitHub Pages website: https://henrymeraldcompany-bit.github.io/gozie-live/

## Target Cloudflare architecture

| Requirement | Cloudflare product | Responsibility |
|---|---|---|
| Web application and API | Workers + Workers Static Assets | Serve the React application and authenticated API |
| User accounts | Workers + D1 | Password hashing, verification state, sessions, role authorization |
| Relational application data | D1 | Hosts, sessions, contributors, viewers, commands, recordings |
| Per-session coordination | Durable Objects | Membership, presence, admission limits, command ordering, engine leases |
| Camera media routing | Realtime SFU | WebRTC publish/subscribe transport for contributor cameras |
| TURN relay | Cloudflare TURN | Connectivity for networks where direct ICE paths fail |
| Uploads and recordings | R2 | Private image/video/audio assets and final programme recordings |
| Durable background work | Workflows / Queues | Start/stop orchestration, recording finalization and retryable cleanup |
| Scheduled cleanup | Cron Triggers | Expire recordings seven days after session end |
| Programme compositor | Cloudflare Containers (subject to availability and capacity validation) | Server-side picture switching, audio mixing, overlays and final programme encoding |
| Public live delivery | Cloudflare Stream or supported Realtime output path | Deliver the single composed programme to viewers |

Realtime SFU is a managed WebRTC forwarding service, not a complete broadcast switcher or media encoder. The application must implement signaling, identities, authorization, subscriptions, and the production pipeline. The compositor is a separate workload and must run independently of the host's browser. We will not claim full production switching/mixing until the containerized compositor is implemented and tested.

## Current implementation status

- Frontend React/Vite application and GitHub Pages deployment: deployed.
- Private R2 bucket: provisioned and verified.
- D1 database: provisioned in APAC.
- D1 initial schema: applied successfully and saved in the repository.
- D1 Worker binding: pending.
- Removal of all Supabase and LiveKit code/configuration: pending.
- Workers API deployment: pending.
- D1-backed account registration, verification delivery, login and session refresh: pending.
- Durable Object session coordinator: pending.
- Realtime SFU application and credentials: not provisioned.
- TURN configuration: pending.
- Containerized compositor and programme output: pending.
- R2 S3-compatible credentials / binding integration: pending.
- End-to-end camera, viewer, programme, recording and deletion tests: pending.
- Capacity tests at 1, 5, 20, 50, 100, 150 and 200 contributors: pending; 200 is a target admission ceiling, not a tested performance guarantee.

## Security requirements

- Never commit API tokens, SFU app secrets, signing keys, R2 credentials, or session secrets.
- Keep privileged credentials as Worker secrets.
- Use short-lived role-scoped tokens; contributors publish only, viewers subscribe only to the final programme, and hosts administer only their own sessions.
- Store only password hashes using a modern password KDF and constant-time verification.
- Email verification requires a configured Cloudflare-compatible outbound email delivery method. Do not mark an address verified until the code is actually delivered and validated.
- All R2 objects remain private; access through authenticated Worker routes or short-lived signed URLs.
- Seven-day retention is measured from session end, not upload time. A trusted scheduled Worker must delete objects and mark metadata after expiry.

## Deployment sequence

1. Bind the provisioned D1 database to the API Worker and test migrations/queries.
2. Replace the previous Supabase auth and PostgREST data layer with D1-backed Worker code.
3. Implement email verification delivery using an available Cloudflare email product; if unavailable for this account, disclose the exact external dependency rather than silently using another provider.
4. Provision Realtime SFU and TURN; store its app secret only as a Worker secret.
5. Implement Durable Object session coordination and enforce contributor admission.
6. Integrate private R2 uploads and recording storage.
7. Build and deploy the independent compositor using Cloudflare Containers if account eligibility and resource limits support the media workload.
8. Deploy the API Worker and website through Cloudflare Workers.
9. Run real device tests and progressively load test contributors and viewers.

## Important cost and reliability notes

Cloudflare-only does not mean free or unlimited. Realtime egress, Stream delivery, Workers, D1, R2 operations/storage, Containers, and media compute/bandwidth may incur charges. Check current product pricing and account limits before enabling a public 100–200-camera session.
