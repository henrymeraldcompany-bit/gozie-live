# Acceptance and load testing

## Functional acceptance
- Admin creates, schedules, starts, and explicitly ends a session.
- Contributor and viewer links enforce separate permissions.
- Published contributor feeds appear in the admin monitor.
- Admin camera switching changes the same final output for all viewers.
- Per-contributor and global camera mute work.
- Image, video, and audio assets can be selected and independently muted.
- Viewers cannot access raw contributor tracks.
- Authorized users can download the final programme recording.
- Recordings and object copies are deleted seven days after session end.
- Admin dashboard disconnect does not stop the server-side broadcast.

## Progressive capacity
Test 1, 5, 20, 50, 100, 150, then 200 publishing contributors. Record connection success, preview readiness, end-to-end latency, CPU/GPU, memory, bandwidth, audio quality, reconnect behavior, and recording continuity. Test viewer concurrency separately. A capacity target is accepted only after repeatable load tests on documented infrastructure.