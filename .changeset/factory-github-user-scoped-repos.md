---
'@mastra/factory': patch
---

Fixed Factory showing GitHub repositories to org members who cannot access them on GitHub. Previously, once anyone in a Factory org connected GitHub, every member could see and connect any repository in that installation, including private repositories in a teammate's personal account. The repository picker, intake sources, and project repository selection now only offer repositories the signed-in user can access on GitHub. On self-hosted Factory, each member connects GitHub once to record which repositories they can see, and reconnecting refreshes that list.
