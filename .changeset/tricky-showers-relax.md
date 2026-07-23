---
'@mastra/server': patch
---

Fixed a security leak where GET /agents returned other users' private stored agents. The route now applies the same ownership and visibility filtering as GET /stored/agents, so the agents-as-tools picker (and any other consumer of listAgents) only shows agents the caller is allowed to see. Code-defined agents, public agents, and single-user/dev setups are unaffected.
