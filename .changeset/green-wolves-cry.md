---
'@mastra/factory': patch
---

Faster session open for Factory workspaces. The sandbox provisioning route now seeds fresh sandboxes from the repository's prebuilt base checkpoint when one exists, so opening a session fast-forwards an existing checkout instead of doing a full clone. The chat UI also no longer blocks on sandbox provisioning: the composer becomes usable as soon as session metadata and messages load, while the sandbox warms up in the background.
