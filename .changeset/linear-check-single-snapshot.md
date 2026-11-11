---
'@mastra/factory': patch
---

Fixed the platform Linear connection check reading the workspace list twice. A workspace disconnecting between the two reads could make the `linear_get_issue` tool suggest links for the wrong workspace, and every tool build sent an extra request to the rate-limited workspaces endpoint. The check now uses a single read.
