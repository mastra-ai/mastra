---
'@mastra/factory': patch
---

Factory sessions can now push commits that change files under `.github/workflows/`, re-run failed GitHub Actions jobs, and dispatch workflows. Repository tokens now include `workflows` and `actions` write when the GitHub App installation grants them. Installations without those permissions still get a working token with the previous permissions.
