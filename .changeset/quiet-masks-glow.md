---
'@mastra/client-js': patch
'@mastra/core': patch
'@mastra/hono': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/playground-ui': patch
---

Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas.

Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.
