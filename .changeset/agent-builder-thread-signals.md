---
'mastra': patch
---

Opt the Studio agent builder chat into agent thread signals by default, matching the main agent chat. The builder's `useChat` now passes `enableThreadSignals`, gated on the same `MASTRA_AGENT_SIGNALS` flag, so setting `MASTRA_AGENT_SIGNALS=false` keeps the legacy streaming path.
