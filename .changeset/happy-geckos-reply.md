---
'@mastra/server': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Added skill editing and workspace support in the agent CMS. Agents can now toggle skills on/off and associate a workspace. Fixed auto-versioning to compare against the latest draft version instead of the published one, preventing stale draft configs from being returned after saves.
