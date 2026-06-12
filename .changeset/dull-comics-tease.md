---
'@mastra/core': patch
---

Fixed supervisor sub-agent tool preparation so memory tools are available when agents derive their thread and resource from default options. This prevents misleading "Skipping memory tools (no thread or resource context)" debug logs for correctly configured sub-agents.
