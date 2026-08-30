---
'@mastra/server': patch
---

Accepted and preserved the new `id`, `description`, and `metadata` fields on control-flow entries (`parallel`, `conditional`, `loop`, `foreach`, `sleep`, `sleepUntil`, `mapping`) in the dynamic workflow API schemas. Definitions posted over HTTP keep these fields instead of having them silently stripped.

```json
{
  "type": "sleep",
  "id": "wait-before-retry",
  "description": "Pause before retrying the external operation",
  "metadata": { "title": "Wait before retry" },
  "duration": 5000
}
```
