---
'@mastra/factory': patch
---

Keep a session's checkout when `pull.rebase` is configured. Re-opening a workspace whose checkout held uncommitted work failed with `cannot pull with rebase: Your index contains uncommitted changes`, which broke the thread load with a 500. Git refuses for the same reason it refuses a merge — the local work is real — so materialization now recognizes the rebase wording and keeps the checkout as-is instead of failing the open.
