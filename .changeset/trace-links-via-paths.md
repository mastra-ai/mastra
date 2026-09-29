---
'@mastra/playground-ui': patch
---

Trace and thread views now build every outgoing link through the app's `paths` and hide actions whose path resolves to an empty string, so apps that only embed traces no longer show broken links.

- `paths.scorerLink` accepts optional `{ scoreId, entity }` params and owns the scorer URL's query string.
- The trace summary links the agent or workflow through `paths.agentLink` / `paths.workflowLink` instead of hardcoded routes.
- "Open scorer run", "Go to trace", and score Trace/Span ids are hidden or shown as plain text when their path is empty.
