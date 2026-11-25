---
'@mastra/factory': minor
---

Deprecated creating more than one Factory project in an organization. Each organization will have one Factory project. The Factory UI no longer shows **Create factory** in the project switcher: onboarding creates the first project, and the switcher still lists projects that already exist.

`POST /web/factory/projects` still creates a second project, and Factory logs a deprecation warning once per process when it does. Existing projects keep working.
