---
mastra: patch
---

Added a Connections section to Factory settings for managing the Slack account that starts sessions, with a per-Slack-connection toggle for whether new threads open Work-board cards. Work items created from Slack now show Slack as their source instead of Manual, Slack sessions in the sidebar use the work item's title instead of the raw branch name, and a server without the Slack environment configured explains that rather than surfacing a JSON parse error.
