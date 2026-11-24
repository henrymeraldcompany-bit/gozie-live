# GOZIE LIVE architecture — Cloudflare only

## Components

- **Workers + Static Assets:** serves the React application and same-origin API.
- **D1:** host accounts, sessions, contributors, subscriptions, media metadata, and recordings.
- **Durable Objects:** each session gets its own coordinator for active camera admission and presence.
- **Realtime SFU:** receives camera/microphone publications and forwards selected tracks to the host monitor.
- **R2:** private image/video/audio assets and, after the compositor is ready, final-programme recording files.
- **Cron Trigger:** expires recordings seven days after session end.
- **Cloudflare Containers (planned):** independent programme compositor for switching, audio mixing, overlays, encoding and recording.

## Media flow

1. Host signs in through the D1-backed API and creates a session.
2. API issues separate contributor and viewer share links with high-entropy codes.
3. Contributor browser reserves one of 200 session slots through the session Durable Object, then publishes camera/microphone tracks to Realtime SFU.
4. Host subscribes to up to 12 contributor feeds at a time for monitoring.
5. The planned server-side compositor will subscribe to selected camera inputs, apply source/mute commands and produce a single programme output independently of the host browser.
6. Viewers will subscribe only to that final programme output, not the raw contributor room.
7. The compositor will record the final output into private R2. After session end, expiry is calculated as end time plus seven days; Cron removes expired objects.

## Honest implementation boundary

The D1-backed host/session API, contributor admission, browser WebRTC publishing, host preview subscription and R2 uploads have code paths. Email verification still awaits an onboarded Cloudflare sending domain. The independent compositor, final viewer stream, full audio mixer and end-to-end programme recording are not deployed. Do not treat the broadcast system as production-ready until they are implemented and tested.

## Capacity and reliability

The 200 camera limit is an admission ceiling, not proof of 200 simultaneous streams. Test in stages and separately load-test viewers. Preview pages are paginated to 12 feeds. Mobile operating systems can pause camera capture when a phone locks or the browser backgrounds.
