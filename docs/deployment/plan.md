# Deployment plan

Planned separation:

- Static web frontend: Cloudflare Pages or equivalent.
- API and scheduled jobs: Cloudflare Workers or a dedicated backend.
- Database: Supabase Postgres.
- Uploads and recordings: Cloudflare R2 or compatible object storage.
- Real-time media: LiveKit Cloud initially; evaluate self-hosting only after operational capacity is understood.
- Production compositor/mixer: dedicated compute service sized through benchmarks.

Deployment is not configured. Do not add credentials to this repository. Configure secrets in each provider's dashboard after the architecture and account selection are confirmed.
