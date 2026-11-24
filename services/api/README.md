# API service

API responsibilities: authentication, session lifecycle, contributor admission, short-lived LiveKit token issuance, asset metadata, viewer metrics, recording metadata, and authorization.

Never issue publisher tokens to viewers. Never trust a role supplied by the browser; resolve roles from server-side records. Store secrets in the deployment secret manager.

Implementation status: documentation scaffold only. No API endpoints are active yet.
