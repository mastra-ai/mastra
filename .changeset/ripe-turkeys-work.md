---
'@mastra/core': patch
'@mastra/server': patch
---

Enforced configured FGA permissions for internal agent memory and Agent Controller operations, including actor and acting-agent attribution. Agent Controller routes that create or resume sessions now require execute permission. Applications without an FGA provider are unchanged.
