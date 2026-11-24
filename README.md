# GOZIE LIVE

Multi-camera live streaming and broadcast production platform.

## Project status

This repository currently contains the project foundation and a starter web interface. It is **not yet a production streaming service**. Live camera ingest, SFU routing, server-side program switching/mixing, viewer delivery, recording, and retention cleanup must be implemented and load-tested before public broadcasts.

## Product surfaces

- **Admin Studio** — create sessions, manage contributors, select the program source, control audio/media, monitor viewers, and manage recordings.
- **Camera Studio** — contributors join using a session link, enter a display name, grant camera/microphone permissions, and publish their feeds.
- **Viewer** — audiences watch only the final program output.

## Architecture

See [docs/architecture/overview.md](docs/architecture/overview.md). The intended design uses a WebRTC SFU (LiveKit initially), a server-side production engine, an API, a database, and object storage. The production engine must continue independently of the admin browser.

## Development

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Copy `.env.example` to `.env` for local configuration. Never commit credentials or real tokens.

## Repository layout

- `apps/web` — React + TypeScript web application
- `services/api` — API service foundation
- `services/media-engine` — server-side production engine design and integration boundary
- `database/migrations` — SQL schema migrations
- `packages/shared-types` — shared domain types
- `docs` — architecture, security, deployment, and testing notes

## Capacity and reliability

The target of 100–200 camera contributors is a design and load-testing target, not a guarantee. Capacity depends on SFU configuration, media bitrate, server resources, network conditions, and viewer count. Test progressively before production use.
