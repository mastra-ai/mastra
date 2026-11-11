---
'@mastra/code-sdk': minor
---

Added `MASTRACODE_AGENT_STREAMS=off` to run the code agent without publishing its runs on a resumable stream. Set it to compare a Factory deployment with agent streams on and off without a code change. Any value other than `on`, `off`, or unset fails at startup.

```sh
MASTRACODE_AGENT_STREAMS=off mastra factory dev
```
