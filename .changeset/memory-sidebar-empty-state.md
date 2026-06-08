---
'@internal/playground': patch
---

Refined the agent chat Memory sidebar in Studio. The left Memory panel is now always visible: when the agent has no memory configured it shows an empty state explaining that conversations are only saved as threads when memory is enabled, with a link to the Agent Memory docs, and the Threads/Memory Configuration tabs are hidden until memory is active. Removed the "Memory" title/icon header from the sidebar and the "Agent Memory On/Off" row from the agent Overview metadata. Renamed the "Configuration" tab to "Memory Configuration", widened the sidebar's default width, and tightened the configuration panel's padding for consistent spacing.
