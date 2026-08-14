---
'@mastra/core': patch
---

Refresh storage-backed dynamic workflows when creating a new run and persist the exact root-plus-nested dynamic definition revision in run snapshots, so replicas converge while existing runs remain pinned across resume and restart. Code-defined nested workflows continue to follow the host deployment and must remain resume-compatible.
