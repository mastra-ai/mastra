---
'mastracode': patch
---

Improved message handling while the agent is running. Sending a message now queues it by default instead of interrupting. Hitting Escape stops the current response and smoothly starts the next queued message. Added Ctrl+Q to toggle between queue and interrupt modes.
