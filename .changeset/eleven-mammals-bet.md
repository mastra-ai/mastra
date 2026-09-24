---
'@mastra/memory': patch
---

Fixed Observational Memory saving its own instructions and system reminders as things the user said. The observer could record lines like "User's current priority is to extract new observations" as the thread's current task, which then misled the agent on later turns. The observer now receives its instructions after the conversation instead of as a separate message before it, and system reminders and signals in the conversation are labeled by their tag (for example `system-reminder` or `notification`) instead of as the user. Fixes [#22195](https://github.com/mastra-ai/mastra/issues/22195).
