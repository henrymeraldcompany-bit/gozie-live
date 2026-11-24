# GOZIE LIVE

A multi-camera live streaming and broadcast-production platform.

## Current status

The repository now contains an interactive React studio, a Cloudflare Worker API foundation, role-scoped LiveKit token issuance, a Supabase database migration set, private R2 asset storage integration, viewer presence, production command queueing, and seven-day recording cleanup logic.

**This is not yet a complete production broadcast service.** Supabase and LiveKit projects have not been provisioned, the Worker is not deployed, and the independent media engine that composites/mixes/publishes the final programme is not yet implemented. The viewer programme room remains offline until that engine is running.

## Product surfaces

- **Admin Studio** — authenticate, create sessions, share contributor/viewer links, monitor feeds, upload media, and queue production controls.
- **Camera Studio** — contributors join with a session-specific link and publish camera/microphone tracks.
- **Viewer** — audience members subscribe only to the final programme room.

## Development

Requirements: Node.js 22.22+ and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Copy `.env.example` to `.env`. Apply database migrations in order. See [API setup](services/api/README.md) and [deployment plan](docs/deployment/plan.md). Never commit credentials.

## Capacity

100–200 contributors is a target that must be validated with real SFU and media-engine load tests. Viewer capacity is separate. Start with small tests and increase progressively while measuring CPU/GPU, memory, bandwidth, packet loss, publish success, latency, audio quality, recording and reconnect behaviour.
