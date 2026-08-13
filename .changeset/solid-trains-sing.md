---
'@mastra/factory': patch
---

Added a Skills page under the Agent section in Factory settings that shows the pipeline stage skills (Triage, Planning, Review, Re-review) with their playbook content, backed by a new GET /web/factory/skills endpoint. Also fixed a noisy checkpoint warning when the sandbox does not support snapshots.
