---
'mastra': patch
---

Added `hybrid` to the Factory project `modelScope` values accepted by `mastra api factory project update`.

Set the update request body to:

```json
{ "modelScope": "hybrid" }
```

Interactive sessions use their owner's personal model and credentials. Work-item threads use the Factory's default model and organization credentials.
