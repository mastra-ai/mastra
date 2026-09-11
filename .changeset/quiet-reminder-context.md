---
'@mastra/memory': patch
---

Improve passive Subconscious reminder context by supplying accumulated parent-visible active observations and a bounded head-and-tail view of observed messages. The message window is capped at 11,264 characters and 3,072 estimated tokens, including omission markers, while tool results retain the existing 10,000-token safeguard. The cap applies to the message window, not the entire reminder prompt. Clarify that reminders should distinguish previously shared facts from unshared candidates using their existing conversation and observation memory. Middle content can be omitted, and suppression remains model-based rather than guaranteed semantic deduplication.
