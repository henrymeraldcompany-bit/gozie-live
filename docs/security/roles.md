# GOZIE LIVE roles and security

- **Host/Admin:** owns sessions and manages invitation links, preview subscriptions, media assets and programme controls for their own sessions.
- **Contributor:** can publish audio/video only to the session associated with their high-entropy contributor link. They cannot access admin controls or subscribe to other cameras.
- **Viewer:** receives viewer access only. Final programme playback will be read-only; viewers cannot publish or access raw contributor feeds.

The API verifies the host session cookie against D1 on every privileged route. Contributor presence uses a separate high-entropy leave secret stored only as a hash. The Durable Object serializes active slot admission and expires stale contributors. Cloudflare Realtime SFU application secrets remain on the Worker and must never be sent to the browser.

R2 objects are private. Asset/recording reads are authorized through Worker routes. Do not expose bucket public access. Email verification is a hard gate for host accounts; do not mark users verified until Cloudflare Email Service has delivered and the code has been checked.
