# GOZIE LIVE roles and security

- **Host/Admin:** creates and owns sessions and manages invitation links, camera previews, media assets and programme controls for their own sessions.
- **Contributor:** can publish audio/video only to the session associated with their high-entropy contributor link. They cannot access host administration or subscribe to other cameras.
- **Viewer:** receives viewer access only. The eventual final-programme playback is read-only; viewers cannot publish or access raw contributor feeds.

The API verifies host session cookies against D1 on every privileged route. Passwords are stored as PBKDF2 hashes, never plaintext. The API issues opaque random session tokens using HttpOnly, Secure and SameSite=Lax cookies and stores only a token hash in D1. Contributor presence uses a separate high-entropy leave secret stored only as a hash. The Durable Object serializes active slot admission and expires stale contributors.

Cloudflare Realtime SFU application secrets stay on the Worker and must never be sent to the browser. R2 objects remain private; asset/recording reads are authorized through Worker routes. Do not enable public bucket access.

Host password recovery is not yet implemented. Users should retain their password securely.
