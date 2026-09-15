---
'mastra': patch
---

Improved Studio agent navigation with Chat, Traces, Evals, and Editor tabs. Config is toggled from the header actions, and unavailable Editor/Evals features show icon-only setup hints on the right. Nested Review under Evals, moved Run options beside the evaluation sub-tabs, added `A` (Attach) and `U` (Run options) shortcuts, and clarified review empty states.

The review queue now lives at the Evals tab, and the old route redirects there:

```text
/agents/my-agent/evaluate?tab=review
```
