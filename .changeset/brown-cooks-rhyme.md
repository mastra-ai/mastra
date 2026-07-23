---
'mastra': patch
---

Fixed the CLI's deploy success message to print the correct URL for Software Factory projects. Factory deploys now show `https://<slug>.factory.mastra.cloud` and a `Factory:` label, instead of the generic `Server:` label pointing at `.server.mastra.cloud`. Non-factory projects are unchanged.
