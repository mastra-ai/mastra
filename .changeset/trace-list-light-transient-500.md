---
'@mastra/playground-ui': patch
---

Fixed the Observability traces list permanently falling back to the heavier trace endpoint after a single server error.

The list asks the server for lightweight trace rows and falls back to the full ones when a server is too old to serve them. A `500` was treated as that signal, so one transient fault — a database hiccup, a request timeout — pinned the tab to the heavier endpoint for the rest of the session, silently undoing the bandwidth savings until a reload. A `500` now falls back for that request only; the session switches for good once the errors have lasted more than ten seconds, which no longer looks like a hiccup. A `404` still switches immediately, since a server without the route will never grow one mid-session.

Also removed two dead fallbacks from the traces list: the entity column no longer reads `attributes.agentId`/`attributes.workflowId`, and the status column no longer reads `attributes.status`. Trace rows carry `entityName`/`entityId` and a computed `status` directly, and lightweight rows never carry `attributes` at all. The `attributes` field and the exported `TraceAttributes` type are gone from `TracesListViewTrace`:

```tsx
// Before — attributes were accepted and read as a fallback
<TracesListView traces={[{ traceId, name, createdAt, attributes: { status: 'completed' } }]} />

// After — rows carry status and entity naming directly
<TracesListView traces={[{ traceId, name, createdAt, status: 'success', entityName: 'weatherAgent' }]} />
```
