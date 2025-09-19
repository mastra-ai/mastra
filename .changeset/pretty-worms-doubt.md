---
"@mastra/core": minor
"@mastra/server": patch
---

Allow agent instructions to accept SystemMessage types

Agents can now use rich instruction formats beyond simple strings:
- CoreSystemMessage and SystemModelMessage objects with provider-specific options
- Arrays of strings or system messages
- Dynamic instructions returning any SystemMessage type
