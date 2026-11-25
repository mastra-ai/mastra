---
'@mastra/react': patch
---

Fixed `useChat()` showing nothing new after its thread stream ended or broke, for example when a phone locks or the network drops while a reply is written. It now follows the thread again and catches up from the stored history: a reply that finished meanwhile shows whole, and one still running goes on without repeating what was already shown.
