---
'@mastra/playground-ui': patch
---

Added `@mastra/playground-ui/lib/form/json-draft` with the helpers that the workflow run form uses for its JSON view: `parseJsonDraft`, `getFormShapeError` and `validateJsonDraft`. Use them to give any `DynamicForm` a JSON view that switches back to the form and validates against the same schema.
