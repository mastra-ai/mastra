---
'@mastra/factory': patch
---

Fixed the GitHub repository list failing entirely when an organization still had a personal-account GitHub installation it is no longer allowed to use; those installations are now skipped. Added a refresh option that bypasses the repository cache so repositories newly granted on GitHub appear without waiting for a webhook.
