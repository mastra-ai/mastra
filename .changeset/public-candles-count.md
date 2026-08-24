---
'@mastra/code-sdk': minor
---

Factory sessions now get a real thread name on their first turn. Mastra's built-in title generation is enabled for them, so a thread is named from the first exchange with the same cheap model the observational-memory observer uses.

Before, a factory session kept whatever name it was created with — the raw first prompt, or nothing at all for work sessions, which fell back to showing their branch — until the observer got far enough into the conversation to name it. Naming now happens on the first turn; the observer still refines it as the thread grows.

TUI sessions are unchanged: they keep being named by the observer, and pay for no extra call.
