# GOZIE LIVE architecture

## Media flow

1. Admin authenticates through Supabase Auth and creates a session in the API.
2. The API returns two independent share links: contributor and viewer.
3. Each contributor receives a short-lived LiveKit token restricted to publishing in the contributor room, without subscribing to other cameras.
4. Admin receives subscribe-only access to the contributor room for monitoring.
5. A separately hosted production engine subscribes to contributor inputs, processes source/audio commands, composites one final programme, and publishes it to a separate programme room.
6. Viewers receive subscribe-only tokens for the programme room. They cannot publish and cannot join the raw contributor room.
7. The engine records the same final programme output. After session end, the recording is available until seven days after the recorded end time.
8. An hourly trusted Worker job deletes expired recording objects from private R2 storage and marks their rows deleted.

## Components

- Web app: Admin Studio, Camera Studio, Viewer.
- API: authentication, session lifecycle, token issuance, R2 media assets, viewer presence, production command queue, recording metadata.
- SFU: LiveKit (project still needs provisioning).
- Production engine: dedicated media compositor/mixer and recorder (not yet implemented).
- PostgreSQL: sessions, contributors, media assets, production commands, viewer presence and recording metadata (Supabase project still needs provisioning).
- Object storage: private Cloudflare R2 bucket provisioned as `gozie-live-media`.

## Security boundaries

Viewer tokens can subscribe only and use the dedicated programme room. Contributor tokens can publish only to the contributor room and cannot subscribe. The admin receives monitor access to the contributor room and subscribe access to the programme room. Service secrets stay in Worker secrets, not browser variables or Git.

The API verifies the admin JWT with Supabase Auth before using server-side database credentials. Public share codes are high-entropy bearer links; anyone who receives a contributor link can publish to that session, so links should be shared only with intended contributors.

## Reliability and capacity

The admin browser is a control surface, not the media server. The production engine must own the broadcast lifecycle and be supervised independently. Camera capture can still be suspended by mobile operating systems when a contributor backgrounds or locks their phone.

A 100–200 camera target requires progressive load tests. Admin monitoring should use low-resolution previews and pagination; displaying 200 full-resolution feeds simultaneously is not a realistic phone workload. Viewer capacity is a separate scaling dimension. Do not promise zero latency; measure source-to-preview and source-switch-to-viewer delay on representative networks.
