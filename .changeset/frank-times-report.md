---
'@mastra/factory': patch
---

Fixed private sessions being reachable by teammates through the agent session and memory routes. A session's memory now says who can read it: a private session lives on its owner's memory, a shared one on its Factory's. Streaming, sending messages, reading threads, changing state, memory settings, and memory reads now return "not found" unless the memory belongs to you or to a Factory in your organization. The list of active runs no longer shows runs on other people's memory.

Existing user sessions were already moved onto their owner's memory, so they are now private: on startup they are marked private, and teammates no longer see them in session lists or can open them. Their owner can share one again from its menu.
