---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step. It contains `sha256:<digest of the setup commands>`, so a sandbox booted from the template can tell that this setup already ran.
