# Deployment plan

## Provisioned resources

- Cloudflare account: dedicated **Live Stream** connection.
- Private R2 bucket: `gozie-live-media` (APAC location hint, Standard storage).
- Bucket is not publicly exposed. No credentials or API tokens are stored in GitHub.

The R2 bucket is provisioned for future uploaded media and final programme recordings. Upload/download access still needs to be implemented through authenticated, short-lived signed requests. Seven-day deletion must be scheduled relative to each session's end time by a trusted backend; no blanket bucket lifecycle expiry has been applied.

## Planned separation

- Web frontend: Cloudflare Workers with Static Assets.
- API and scheduled jobs: Cloudflare Workers or a dedicated backend.
- Database: Supabase Postgres (not provisioned).
- Uploads and recordings: Cloudflare R2 (bucket provisioned; app integration pending).
- Real-time media: LiveKit Cloud initially; evaluate self-hosting only after operational capacity is understood.
- Production compositor/mixer: dedicated compute service sized through benchmarks.

## Deployment status

The frontend has not yet been deployed. No Worker, database, LiveKit project, media engine, or CI deployment secret is configured. Do not commit credentials. Configure secrets in provider secret managers only.
