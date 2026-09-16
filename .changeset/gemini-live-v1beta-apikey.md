---
'@mastra/voice-google-gemini-live': patch
---

Fix API-key (non-Vertex) Gemini Live connections being pinned to the `v1alpha` WebSocket endpoint. `v1alpha` rejects current Live models (e.g. `gemini-2.0-flash-live-001`) during setup, so the session never reached `setupComplete` and `connect()` only failed via the 30s timeout. API-key connections now use the `v1beta` Live endpoint (matching the Vertex branch already on `v1beta1`), so current Live models connect successfully.
