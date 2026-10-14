---
'@mastra/core': patch
---

Disabled workspace tools no longer add setup work on every agent turn. Agents with workspace tools turned off now start each turn faster and allocate less memory. Fixes #26401.
