---
'@mastra/memory': patch
---

Fixed Subconscious reminders never reaching the main agent in `AgentController` sessions. Reminder checks, memory questions and their follow-ups now run on the reminder's own thread.
