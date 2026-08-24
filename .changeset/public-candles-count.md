---
'@mastra/code-sdk': minor
---

Threads now get a real name on their first turn, and keep it. Mastra's built-in title generation is enabled for mastracode sessions, so a thread is named from the first exchange with the same cheap model the observational-memory observer uses.

Before, a session kept whatever name it was created with — the raw first prompt, or nothing at all for factory work sessions, which fell back to showing their branch — and the observer renamed the thread again as the conversation grew, so the name kept moving under you. The observer no longer renames threads: naming happens once at creation, and after that only when you ask for it.
