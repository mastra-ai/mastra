---
'mastra': patch
---

Added `hybrid` to the Factory project `modelScope` values accepted by `mastra api factory project update`.

Set the update request body to:

```json
{ "modelScope": "hybrid" }
```

Interactive sessions use their owner's personal model and credentials. Work-item threads use the Factory's default model and organization credentials.

Factory settings now offer a "Personal for sessions, Factory for work items" model scope. The chat model picker lists the models and default of the thread's billing scope: the session owner's for interactive threads, and the Factory's for work-item threads, including after the work item finishes.
