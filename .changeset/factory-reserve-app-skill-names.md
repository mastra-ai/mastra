---
'@mastra/factory': patch
---

Repository skills no longer collide with skills your app ships in its own Factory skills directory. Previously only Factory's bundled skill names were protected, so a repository skill with the same name as an app-defined skill made that skill unresolvable and broke any board phase that invoked it. In Factory sessions, repository skills that share a name with any Factory-served skill (bundled or app-defined) are now hidden.
