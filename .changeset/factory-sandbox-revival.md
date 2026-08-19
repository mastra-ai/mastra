---
'@mastra/factory': patch
---

Factory sessions now revive a sandbox that dies mid-session instead of erroring the turn. When a command fails with a destroyed-sandbox error (for example after idle garbage collection), or with an exec-transport error whose connection never opened (so the command provably never started), the session drops the dead handle, re-runs the provisioning pipeline (reattach, checkpoint-seeded provision, or fresh clone), and retries the command once. Transport errors where the command may have already run are surfaced instead of replayed, so side effects like `git commit` cannot execute twice. Concurrent failures coalesce onto a single revival.
