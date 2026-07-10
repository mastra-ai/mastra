---
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed GitHub App authentication failing with a private key decoder error when the PEM in GITHUB_APP_PRIVATE_KEY had its newlines stripped by env tooling. Flattened single-line keys are now rebuilt into valid PEM automatically.
