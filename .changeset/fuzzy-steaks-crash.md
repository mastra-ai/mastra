---
'@mastra/core': minor
---

Added direct skill path discovery — you can now pass a path directly to a skill directory or SKILL.md file in the workspace skills configuration (e.g., `skills: ['/path/to/my-skill']` or `skills: ['/path/to/my-skill/SKILL.md']`). Previously only parent directories were supported. Also improved error handling when a configured skills path is inaccessible (e.g., permission denied), logging a warning instead of breaking discovery for all skills.
