---
'@mastra/factory': patch
---

Factory now switches a bound session onto its card's thread as the session owner. Previously the switch carried no signed-in user, so loading the thread's memory failed with "the request has no authenticated user" and the card's run never started.
