---
'@mastra/memory': patch
---

Fixed Subconscious reminders running on the wrong thread. A reminder sidekick rewrote the parent's thread id in its request context to another id, and that id outranked its own reminder thread, so its passive checks, questions and continuations ran on a third thread. Under an AgentController session this meant passive reminders never reached the main agent. Reminder runs now name their own thread in the request context.
