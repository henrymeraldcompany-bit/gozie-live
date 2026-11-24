# Media engine

This service is the critical production boundary. It must subscribe to contributor tracks, maintain low-resolution admin previews, select one programme video source, mix allowed contributor/media audio, composite image/video overlays or replacement sources, publish one final programme output to viewers, and record that same output.

The engine must run independently of the admin browser. A browser disconnect must not terminate a broadcast.

Recommended first implementation: LiveKit SFU for ingest and routing, with a dedicated server-side compositor/mixer and recording pipeline. Validate codec support, CPU/GPU requirements, reconnect behavior, and end-to-end latency before production.

**Not implemented yet:** ingest, switching, mixing, egress, recording, or failover. Do not represent this placeholder as a working broadcast server.
