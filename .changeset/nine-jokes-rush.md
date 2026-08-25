---
'@mastra/factory': patch
---

Intake listings no longer fail as a whole when one provider is down. `GET /web/intake/sources` and `GET /web/intake/items` now query every connected provider concurrently and isolate the ones that error, returning what the healthy providers answered plus a `failures` entry per broken provider so the UI can show a per-source error instead of an empty board.

```json
{
  "sources": [{ "integrationId": "github", "id": "repo-1", "name": "acme/app", "type": "repository" }],
  "failures": [{ "integrationId": "linear", "message": "Linear token expired" }]
}
```

A provider that fails mid-pagination keeps the cursor it came in with, so the next page resumes where it left off instead of replaying its first page.
