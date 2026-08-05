---
'@mastra/server': minor
---

Added HTTP validation for transient agent signals. Non-state signals accept `transient: true`, while state signals reject the option because state tracking requires persisted history.

```json
{
  "signal": {
    "type": "reactive",
    "contents": "Stay on the current task.",
    "transient": true
  }
}
```
