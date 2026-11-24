# GOZIE LIVE architecture

## Main flow

1. Admin authenticates and creates a broadcast session.
2. API creates separate contributor and viewer entry points and issues role-scoped, short-lived media tokens.
3. Contributor devices publish camera and microphone tracks to the SFU.
4. Admin receives monitor previews and sends programme-source/audio-control commands to the server-side production engine.
5. The engine produces one final programme stream and publishes it to viewers while recording that same output.
6. A trusted scheduled cleanup deletes recording objects and metadata seven days after the session ends.

## Components

- Web app: Admin Studio, Camera Studio, Viewer.
- API: authentication, session and role authorization, tokens, asset metadata, recording lifecycle.
- SFU: WebRTC ingest and track distribution (LiveKit is the initial candidate).
- Production engine: server-side video switching/compositing, audio mixing, programme output, recording.
- PostgreSQL: sessions, contributors, media assets, recording metadata.
- Object storage: uploaded media and final recordings.

## Important constraints

The admin browser is a control surface, not the media server. The media engine must own the broadcast lifecycle. Camera capture can still be suspended by mobile operating systems when a contributor backgrounds or locks their phone.

A 100–200 camera target requires progressive load tests and capacity planning. Admin monitoring should use low-resolution previews and pagination; displaying 200 full-resolution feeds simultaneously is not a realistic phone workload. Viewer capacity is a separate scaling dimension.

Do not promise zero latency. Measure contributor-to-preview and source-switch-to-viewer latency on representative devices and networks.
