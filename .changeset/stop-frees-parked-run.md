---
'@mastra/core': patch
---

Fixed a message sent after Stop on a run parked on a tool suspension (a question to the user, a pending generation) never being answered. Stop now releases the parked run in the thread runtime, so the next message starts its own run, and a message sent right after Stop waits for the stopped run's subscription to detach before it is sent, so the new run's events reach the session. Runs parked on a tool approval keep their own decline path.
