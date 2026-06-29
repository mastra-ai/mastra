---
'@mastra/server': patch
---

Fixed inline skills (created via createSkill()) not appearing in the Dev Portal. The server now uses agent.listSkills() and agent.getSkill() which return both inline and workspace skills, instead of only querying workspace skills.
