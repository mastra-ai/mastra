---
'@mastra/factory': minor
---

Added label reconciliation and label filtering to Factory work and review boards. GitHub pull requests, GitHub issues, and Linear issues now keep their labels in sync with the provider, and boards expose a searchable multi-select label filter that shares state through the URL.

Selected labels round-trip through the `label` query parameter (repeated per label to preserve values containing commas):

```
/factory/project/<id>/work?label=bug&label=needs%20triage
/factory/project/<id>/review?teammate=<userId>&label=priority%3Ap0
```

