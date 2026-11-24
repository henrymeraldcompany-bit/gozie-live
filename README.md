# GOZIE LIVE

A multi-camera live streaming and broadcast-production platform.

## Current implementation

The repository contains:
- Responsive Admin Studio, Camera Studio, Viewer, and a server-side LiveKit Egress composition template.
- Supabase Auth integration and owner-scoped session API.
- Separate publish-only contributor tokens and subscribe-only viewer tokens.
- LiveKit room/RTMP Ingress and composite Egress orchestration.
- Host controls for camera source selection, contributor mute/all mute, and media source selection.
- Private R2 asset uploads; optional MP4 Egress output to R2.
- Viewer presence counts, recording downloads, and scheduled deletion seven days after a session ends.
- Atomic admission capped at 200 active contributor cameras per session, with 20-second heartbeats and stale-slot expiry after 60 seconds.
- SQL command claiming to prevent competing workers from applying the same production control twice.
- GitHub Actions checks for dependency install, TypeScript checks, and the production web build.

**Not yet production-verified:** Supabase and LiveKit projects have not been connected, the Worker and frontend have not been deployed, R2 S3 recording credentials are not configured, and the full live broadcast path has not been exercised. LiveKit can deliver the final programme only after these external services are configured. A session status change alone is not proof that viewers are receiving the stream.

## Product surfaces

- **Admin Studio** — authenticate, create sessions, share QR invitation links, monitor contributors and final programme output, select the programme source, manage audio, and upload media.
- **Camera Studio** — contributors join through their own link and publish their phone camera/microphone.
- **Viewer** — audience members subscribe only to the final programme output and can download a completed recording while it is retained.
- **Egress renderer** — runs in LiveKit's server-managed Egress browser, independent from the admin browser.

## Development

Requirements: Node.js 22.22+ and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Copy `.env.example` to `.env`, configure the public frontend values, and apply the database migrations in order. See [API setup](services/api/README.md) and [deployment plan](docs/deployment/plan.md). Never commit credentials.

For Cloudflare Workers static-asset hosting, run `npm run deploy:web` from the repository root after building. Deploy the API separately with `npm run deploy:api`.

## Capacity and reliability

The API enforces a maximum of 200 active contributor slots per session. The practical capacity of 100–200 live cameras is still a target requiring progressive real-world load tests. Viewer capacity is separate. Measure publish success, preview readiness, end-to-end latency, egress CPU, memory, bandwidth, packet loss, audio quality, recording integrity, and reconnect behaviour at 1, 5, 20, 50, 100, 150, and 200 publishers. No zero-latency or 200-camera production guarantee is made.
