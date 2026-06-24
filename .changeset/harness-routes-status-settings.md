---
'@mastra/server': minor
'@mastra/client-js': minor
---

Enrich the harness HTTP session surface so a client can render a status line,
read behavior settings, and scope threads per working directory.

`GET /harness/:harnessId/sessions/:resourceId` now also returns:

- `omProgress` — the status-line slice of observational-memory progress
  (pending tokens vs. observation threshold, accumulated observations vs.
  reflection threshold, plus projected message removal / reflection savings)
- `tokenUsage` — cumulative token usage for the current thread
- `settings` — agent behavior settings (`yolo`, `thinkingLevel`,
  `notifications`, `smartEditing`)

`GET /harness/:harnessId/sessions/:resourceId/threads` accepts an optional
`projectPath` query param. A single resourceId can be shared across git
worktrees of the same repo (the id is derived from the git URL), so passing
`projectPath` scopes the list to threads tagged for that working directory.
Each returned thread now also includes its `projectPath` metadata.

The session event stream route (`.../stream`) now enqueues raw event objects
and lets the server adapter handle SSE framing, fixing a double-framing bug
where events were wrapped twice (`data: "data: {...}\n\n"\n\n`) and could not be
parsed by clients.

`@mastra/client-js` gains the matching types and reads:

- `HarnessOMProgress` and `HarnessSessionSettings`, surfaced on
  `HarnessSessionState` (`omProgress`, `tokenUsage`, `settings`)
- a `display_state_changed` event in `KnownHarnessEvent` carrying the
  status-line figures
- `HarnessSession.listThreads()` now accepts either a number (back-compat) or
  `{ limit?, projectPath? }`
