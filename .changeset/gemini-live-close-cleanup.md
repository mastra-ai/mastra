---
'@mastra/voice-google-gemini-live': patch
---

Fixed cleanup when the Gemini Live server closes the socket. A close from the server side (1011, goAway, a network drop) only changed state and emitted events, and the app's later `disconnect()` returned early with "Already disconnected". So the open `speaker` stream for the current reply never ended, leaving anything piping or awaiting it hung, and the `maxDuration` timer (up to 24h) kept the process alive and later called `disconnect()` on whatever session was current. The close and error handlers now end speaker streams and clear the session timers, including the `sessionExpiring` warning timer, which was never stored and so could not be cleared before. The events emitted on close are unchanged.

Fixes [#26694](https://github.com/mastra-ai/mastra/issues/26694).
