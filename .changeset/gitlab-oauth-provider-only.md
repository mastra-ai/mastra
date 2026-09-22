---
'@mastra/factory': patch
---

Platform GitLab discovery now considers only connections on the Platform's `gitlab` (OAuth) integration. The `gitlab-group`, `gitlab-group-token` and `gitlab-pat` integration ids are no longer queried or accepted, so connections created through those flows are not discovered.
