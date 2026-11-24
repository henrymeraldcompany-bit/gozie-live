# GOZIE LIVE production renderer

The current implementation uses LiveKit's server-managed Egress compositor rather than running media processing inside the host's browser.

## Implemented orchestration path

- The API creates a dedicated programme-room RTMP ingress.
- It starts LiveKit composite Egress on the contributor room with the custom template URL `/?mode=engine&sessionId=...&controlCode=...`.
- LiveKit appends the recorder's room URL and short-lived recorder token to the template URL. The template connects to the contributor room and signals `START_RECORDING` after the connection succeeds.
- The renderer shows the currently selected camera, or replaces that picture with an uploaded image/video. Contributor audio tracks are independently attached; the host's mute state is polled from the API.
- The same Egress outputs the composition to the programme-room RTMP ingress and, when R2 S3 credentials are configured, to an MP4 file in private R2.
- The API stops Egress when the host ends the session, checks for the finished R2 object, registers recording metadata, and sets expiry to seven days after the session end.

## Important boundaries

This integration is committed but has not been deployed or tested against a real LiveKit Cloud project. It depends on the frontend being deployed and `APP_ORIGIN` being set to that origin. It also depends on LiveKit Egress/Ingress being enabled for the project.

R2 recording requires `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_S3_ENDPOINT` as Worker secrets. Without them, the API may start the live programme output, but no recording file is requested.

A 100–200 contributor target needs progressive load tests. Egress decode/composition, SFU bandwidth, R2 upload, network quality and viewer distribution need real measurements. The admin monitor is paginated to avoid attempting to render 200 full-resolution camera previews on a phone. Mobile operating systems can still suspend contributor capture when a phone is locked or the browser is backgrounded.
