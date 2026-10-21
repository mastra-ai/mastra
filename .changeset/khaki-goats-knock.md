---
'@mastra/core': patch
---

Fixed a thread that stopped starting runs after a run waiting on a tool prompt was followed by another run on the same thread. Once that other run finished, every new message, signal or notification was reported delivered but never ran until the process restarted. The waiting run now gives the thread up when another run takes it over, and it can still be resumed with the user's answer. A run that is still waiting on its prompt keeps holding the thread as before.
