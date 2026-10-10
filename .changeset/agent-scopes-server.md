---
'@mastra/server': patch
---

Agent routes now ignore `scopes` in request bodies, including `ifIdle.streamOptions.scopes`, and `mastra__scopes` is a reserved request context key. Set scopes from server middleware with `MASTRA_SCOPES_KEY` instead. A conflicting `resource:` or `thread:` scope returns a 400 error.
