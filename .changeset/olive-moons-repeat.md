---
'@mastra/factory': patch
---

Fixed new Slack threads starting chat-only sessions when they cannot be backed by a repository.

- Explain in Slack why a new Factory session cannot start when the linked project has no repository or source-control connection.
- Keep account-link and project-selection prompts for senders who cannot yet be routed.
- Keep chat-only sessions for deployments without account linking, projects, or source-control integration.
- Leave existing Slack conversations unchanged.
