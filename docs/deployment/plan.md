# Deployment plan

## Provisioned resources

- Cloudflare account: dedicated **Live Stream** connection.
- Private R2 bucket: `gozie-live-media` (APAC location hint, Standard storage).
- Bucket is not publicly exposed. No credentials or API tokens are stored in GitHub.

## Implemented repository foundations

- Cloudflare Worker API source, Wrangler configuration, R2 binding, and hourly cleanup handler are committed.
- API source includes Supabase Auth verification, owner-scoped session endpoints, separate contributor/programme LiveKit token grants, R2 asset upload, viewer heartbeat, recording metadata, and production-command queue.
- Database migrations include ownership policies, contributor metadata, production command queue, and viewer-presence records.
- Frontend work is being connected to these API contracts.

## Still requiring external configuration or implementation

- Supabase project and migrations: not provisioned.
- LiveKit project: not provisioned.
- Worker secrets and API deployment: not configured or deployed.
- Web frontend: not deployed.
- Independent production compositor/mixer: not implemented or deployed.
- Automated recording, playback and end-to-end deletion: not tested against a live media engine.

## Retention behaviour

Recording deletion is scheduled hourly by the Worker and calculated from each session's end time plus seven days. No blanket R2 lifecycle expiry is configured, because that would incorrectly measure retention from upload time.

Never commit service-role keys, LiveKit secrets, or the engine shared secret.
