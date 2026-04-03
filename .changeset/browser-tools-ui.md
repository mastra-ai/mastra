---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Display browser tools in Agent details UI

Adds a "Browser Tools" section to the agent metadata panel in the playground, showing
tools provided by the agent's browser configuration. Server now serializes browser tool
names alongside workspace tools.
