---
'@mastra/factory': patch
---

Added approval-free Factory supervisor session updates for model, mode, memory settings and thread title. Updates report whether each field applies now, at the next run start, at the next thread switch, or was skipped. Worker signaling is also approval-free and audited.

In authenticated supervisor chat, `factory_update_session` accepts:

```json
{ "target": { "all": true }, "changes": { "memory": "resync" } }
```

This reapplies stored Factory memory settings to idle active workers; busy workers are reported as skipped.
