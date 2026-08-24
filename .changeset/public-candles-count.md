---
'@mastra/code-sdk': minor
---

Threads now get a real name on their first turn. Mastra's built-in title generation is enabled for mastracode sessions, so a thread is named from the first exchange with the same cheap model the observational-memory observer uses.

Before, a session kept whatever name it was created with — the raw first prompt, or nothing at all for factory work sessions, which fell back to showing their branch — until the observer got far enough into the conversation to name it. Naming now happens on the first turn; the observer still refines it as the thread grows.
