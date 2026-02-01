---
'@mastra/server': minor
---

Added skills.sh proxy endpoints for browsing, searching, and installing skills from the community registry.

**New endpoints:**

- GET /api/workspaces/:id/skills-sh/search - Search skills
- GET /api/workspaces/:id/skills-sh/popular - Browse popular skills
- GET /api/workspaces/:id/skills-sh/preview - Preview skill SKILL.md content
- POST /api/workspaces/:id/skills-sh/install - Install a skill from GitHub
- POST /api/workspaces/:id/skills-sh/update - Update installed skills
- POST /api/workspaces/:id/skills-sh/remove - Remove an installed skill
