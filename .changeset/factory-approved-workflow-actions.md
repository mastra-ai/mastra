---
'@mastra/factory': patch
---

Factory sessions on GitHub can now re-run failed Actions jobs and push commits that change `.github/workflows/`, each only after a person approves it. The approver sees the exact run, or the full new content of every workflow file the push changes. The sandbox's own token keeps its previous permissions; the approved operation runs on the server with a short-lived token for that one repository.
