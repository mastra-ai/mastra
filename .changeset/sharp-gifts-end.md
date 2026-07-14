---
'@mastra/ai-sdk': patch
---

Fixed a crash in the AI SDK stream transformer when a supervisor agent delegates to a remote A2A agent (A2AAgent) through chatRoute() or handleChatStream. A2A sub-agent streams do not emit a start chunk and use a flat finish payload, which caused the UI stream to end with "Cannot read properties of undefined" errors. The remote agent's answer now streams to the client correctly.
