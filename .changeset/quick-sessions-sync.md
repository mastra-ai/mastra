---
'@mastra/factory': patch
---

The Factory session list loads faster and stops re-downloading every session on each poll.

- `GET /web/factory/projects/:id/sessions?compact=1` returns a smaller list: session rows without `orgId`, `sandboxId` and `sandboxWorkdir`, owners listed once in an `owners` map, plus `total` and `syncedAt`. Without `compact=1` the response is unchanged.
- `updatedSince=<syncedAt>` (with `compact=1`) returns only the sessions changed since the last read, along with the total visible count so clients can tell when a session was removed.
- The list is gzip-compressed when the client accepts it, and the storage lookup uses a fixed number of queries no matter how many repositories a Factory links.
