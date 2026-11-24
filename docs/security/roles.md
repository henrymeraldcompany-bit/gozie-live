# Roles and security

- Admin: owns session, controls programme, audio, assets, contributors, recording.
- Contributor: may publish only to the assigned session; cannot administer or view other contributors' private data.
- Viewer: may subscribe only to the final programme output; cannot publish tracks or access raw contributor feeds.

Use server-side authorization for every API action. Issue short-lived provider tokens with the minimum grants required. Keep provider secrets, database service keys, and object-storage credentials out of browser bundles and Git history. Validate uploads by size, MIME type, and file signature. Apply rate limits to join/token endpoints.
