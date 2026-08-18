---
'@internal/playground': patch
---

Re-enabled Studio playground analytics on all hosts. Playground telemetry was previously limited to Mastra Cloud domains, which stopped usage reporting from locally run and self-hosted Studio instances. Opt-outs via `MASTRA_TELEMETRY_DISABLED` and Brave browser detection are unchanged.
