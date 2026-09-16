---
'@mastra/voice-google-gemini-live': patch
---

Fixed a hang when connecting the Google Gemini Live voice provider with a rejected setup (for example an unknown model id). The server closes the WebSocket with an abnormal code such as 1007, which previously was only logged, so connect() waited out the full 30s timeout and reported a generic timeout instead of the real reason. connect() now rejects immediately, carrying the close code and reason.
