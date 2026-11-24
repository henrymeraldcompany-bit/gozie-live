# GOZIE LIVE

GOZIE LIVE is a multi-camera live-streaming and broadcast-production application. Its target production stack is **Cloudflare-only**.

## Website

Current GitHub Pages preview: https://henrymeraldcompany-bit.github.io/gozie-live/

The frontend source is in `apps/web`. The deployment workflow currently publishes a preview to GitHub Pages. The intended production hosting is Cloudflare Workers + Workers Static Assets.

## Cloudflare architecture

- Workers: application API and web hosting.
- D1: user accounts, sessions, contributor presence, commands and recording metadata.
- Durable Objects: per-session coordination and admission control.
- Realtime SFU + TURN: WebRTC camera publishing and media routing.
- R2: private media assets and programme recordings.
- Workflows / Queues / Cron: durable orchestration and seven-day cleanup.
- Containers: independent server-side compositor for the final programme, subject to account/resource validation.
- Stream: public delivery of the composed programme where the chosen output path supports it.

No Supabase or LiveKit dependency is part of the target architecture. The existing API/frontend still contain legacy integration code that must be removed before the Cloudflare-only backend is deployable.

## Provisioned Cloudflare resources

- Private R2 bucket: `gozie-live-media`.
- APAC D1 database: `gozie-live-db`.
- D1 schema: `database/cloudflare-d1/0001_initial.sql` (applied).

## Current limitations

The website is deployed as a preview, but this does not mean live broadcasting is operational. D1 binding and application migration, Cloudflare Realtime SFU setup, Durable Objects, R2 integration, the independent compositor, and end-to-end media testing remain.

Read [the Cloudflare-only deployment plan](docs/deployment/plan.md).

## Local development

Requirements: Node.js 22.22+ and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
