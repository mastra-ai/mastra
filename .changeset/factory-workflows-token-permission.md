---
'@mastra/factory': patch
---

Factory sessions can now push changes to GitHub Actions workflow files. Repository tokens now include the `workflows` write permission. Before, GitHub rejected any push that touched `.github/workflows/*`. The GitHub App installation must grant the Workflows permission. An installation that hasn't approved it can't mint tokens until an owner accepts the updated permissions on GitHub.
