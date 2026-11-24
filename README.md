# GOZIE LIVE

GOZIE LIVE is a multi-camera streaming and broadcast-production application built on Cloudflare.

## Application website

**Production target:** https://gozie-live.gozielive.workers.dev/gozie-live/

The repository root on GitHub is the source-code/README page. Open the application URL above to use the website.

## Cloudflare infrastructure

- Workers + Static Assets — frontend and API
- D1 — application database
- Durable Objects — per-session coordination and camera admission
- Realtime SFU — WebRTC camera publishing and preview subscriptions
- R2 — private media uploads and recordings
- Cron Trigger — cleanup jobs
- Containers — planned independent programme compositor

There is no Supabase or LiveKit dependency in the target architecture.

## Provisioned resources

- D1 database: `gozie-live-db`
- R2 bucket: `gozie-live-media`
- Realtime SFU app: `GOZIE LIVE production media`
- Workers subdomain: `gozielive.workers.dev`

## Current implementation status

The application includes host authentication endpoints, session management, share links, contributor admission, Cloudflare WebRTC publishing/preview negotiation and private media uploads. Email verification requires a configured Cloudflare Email Sending domain. The independent compositor and final audience programme output are not yet deployed, so the app must not be represented as a fully working broadcast service yet.

See [the deployment plan](docs/deployment/plan.md).

## Local development

Node.js 22.22+ and npm are required.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
