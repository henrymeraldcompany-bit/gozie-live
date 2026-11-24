# GOZIE LIVE programme engine — pending implementation

The programme compositor is **not deployed yet**. This folder is reserved for the server-side media-production service that will run independently of the host's browser.

## Required responsibilities

- Subscribe to authorized contributor camera and microphone publications through Cloudflare Realtime.
- Select one camera as the programme picture, with a designed fallback slate when no camera is selected.
- Replace the programme picture with an uploaded image or video while contributor streams continue.
- Mix selected contributor microphones and imported audio with per-source gain, mute controls, master gain and a limiter.
- Produce one final programme output for all viewers.
- Record the final programme output and store it in private Cloudflare R2.
- Notify the API when a recording is finalized so the API can set expiry to seven days after the session ends.

## Cloudflare-only target

The application API is Cloudflare Workers with D1, Durable Objects and R2. Realtime camera transport currently targets Cloudflare Realtime SFU.

The SFU forwards WebRTC tracks but does not perform production switching or audio mixing. Its WebSocket video adapter emits JPEG frames at a low snapshot rate and is not suitable as a continuous 30 fps video input for a compositor. Do not use that adapter as the programme encoder.

The candidate managed option is Cloudflare RealtimeKit's composite recording and RTMP livestream export with a custom recording layout. This must be tested for camera selection, role permissions, output continuity, audio routing, participant scale and delivery before replacing the current SFU implementation. A custom Cloudflare Container compositor remains an alternative if managed features cannot satisfy those requirements.

## Acceptance criteria

- The production engine continues when the host closes the admin page.
- Switching selected camera changes the same final programme for every viewer.
- Audio mute/gain commands affect the programme mix, not only the host's preview.
- Uploaded media replaces the programme picture or enters the audio mix as requested.
- Recording and final output recover from host disconnects and short network interruptions.
- The engine reports health, errors, resource use and output latency.
- Tests cover multiple camera phones and progressively scale toward 200 contributors.

Until those tests pass, the production output, recording, and viewer playback must be labelled unavailable.
