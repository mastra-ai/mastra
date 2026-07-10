---
"@mastra/voice-google": patch
---

Bump @google-cloud/speech to ^7.5.0 to fix STT (.listen()) failing on Node >= 22 with ERR_STREAM_PREMATURE_CLOSE during ADC token fetch. The v6 line pins gaxios 6.x, which doesn't handle modern Node's stream/HTTP2 behavior on the OAuth token endpoint; v7 pulls in gaxios 7.x (already used transitively by @google-cloud/text-to-speech), aligning STT with the already-working TTS path.
