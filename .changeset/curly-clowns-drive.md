---
'@mastra/livekit': patch
---

Added a voice call mode to the Studio agent chat. When the Mastra server exposes a LiveKit connection route (from `@mastra/livekit`) and a voice worker is running, a phone button in the chat composer starts a realtime voice session with the agent: live captions, agent state (listening, thinking, speaking), and barge-in all surface in the chat, and the conversation lands in the same memory thread as text chat.
