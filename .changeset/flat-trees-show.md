---
'@mastra/observability': minor
---

Model step spans now show the `model` and `provider` the step actually called, also when an input processor switches the model or a fallback model takes over. Steps that call no model, such as a reply served from the response cache, leave both empty.
