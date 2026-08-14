---
'@mastra/core': patch
---

- Refresh storage-backed dynamic workflows when creating a new run so replicas converge on the active definition.
- Pin the root and nested dynamic definition revision in each run snapshot so existing runs keep their graph across resume and restart.
- Preserve code-defined nested workflows as the host deployment's authority. Keep those workflows resume-compatible across deployments.

Before upgrading, allow in-flight dynamic runs created by older versions to finish. Those snapshots don't contain a pinned definition revision, so Mastra now fails closed when you resume or restart them instead of using a possibly different graph.
