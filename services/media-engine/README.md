# GOZIE LIVE production engine

This service is intentionally separated from the admin browser. The target implementation is a long-running media worker that:

1. Joins the session's LiveKit contributor room as a server-side subscriber.
2. Subscribes to incoming camera and audio tracks.
3. Applies queued production commands (source selection, media replacement, contributor mute and audio gain).
4. Composites a single programme video and mixes a single programme audio bus.
5. Publishes only that output to the session's separate LiveKit programme room.
6. Records the exact programme output that viewers receive.
7. Finalizes recording metadata through the API's internal recording endpoint after the session ends.

## Current status

This folder is an integration contract and deployment boundary, not a functioning compositor. The API queues production commands and issues role-scoped SFU tokens, but there is not yet a media worker consuming commands, mixing media, publishing output, or recording. Viewer playback therefore remains offline until this service is implemented and deployed.

A production implementation needs dedicated compute, restart supervision, resource limits, observability, and benchmarked capacity. Do not attempt 100–200 full-resolution source compositing on the admin phone. Use low-resolution multiview previews and progressively test 1, 5, 20, 50, 100, 150, and 200 publishers.
