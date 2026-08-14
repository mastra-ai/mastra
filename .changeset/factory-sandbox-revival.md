---
'@mastra/factory': patch
---

Factory sessions now revive a sandbox that dies mid-session instead of erroring the turn. When a command fails with a destroyed-sandbox or exec-transport error (for example after idle garbage collection), the session drops the dead handle, re-runs the provisioning pipeline (reattach, checkpoint-seeded provision, or fresh clone), and retries the command once. Concurrent failures coalesce onto a single revival.
