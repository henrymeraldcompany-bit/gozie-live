# GOZIE LIVE

GOZIE LIVE is a multi-camera streaming and broadcast-production application built on Cloudflare.

## Open the application

**[GOZIE LIVE application](https://gozie-live.gozielive.workers.dev/gozie-live/)**

The GitHub repository home page shows its README and source code. That is normal for a repository. Use the Cloudflare application link above to open the app.

## Cloudflare infrastructure

- Workers — web application and API
- D1 — host accounts, sessions and metadata
- Durable Objects — per-session state and contributor admission
- Realtime SFU — camera publishing and host preview transport
- R2 — private uploads and recordings
- Cron Triggers — expiry cleanup
- RealtimeKit or Containers — pending final-programme compositing and streaming

There is no Supabase or LiveKit integration in the current application code.

## Provisioned resources

- Worker: `gozie-live` on `gozielive.workers.dev`
- D1 database: `gozie-live-db`
- R2 bucket: `gozie-live-media`
- Realtime SFU app: `GOZIE LIVE production media`

## Current status

The Cloudflare Worker and application bundle are deployed. The D1, R2 and Durable Object bindings are configured, and the hourly cleanup trigger is set. Host accounts use D1-backed password registration and login. Camera publishing still needs the Realtime SFU app secret to be installed as a Worker secret and needs a real phone test.

The independent programme compositor, one final viewer stream, programme audio mixing and final recording are not yet deployed. The 200-camera figure is a configured admission ceiling, not a tested capacity result.

See [the Cloudflare deployment status](docs/deployment/plan.md).

## Local development

Node.js 22.22+ and npm are required.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
