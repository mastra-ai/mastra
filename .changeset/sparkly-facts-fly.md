---
'@mastra/factory': patch
---

Added per-repository changes and touched files in the chat sidebar for sessions whose environment holds several repositories; the agent's file tools and project path are rooted at the workspace root in that case. Files groups are named after the checkout directory and list files written at the workspace root; Changes groups carry the repository slug and its provider icon. A single-repository session is unchanged.
