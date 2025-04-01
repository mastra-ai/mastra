---
'@mastra/deployer': patch
---

Fixed a bug where the hono body wasn't properly passed into stream+generate API handlers resulting in "cannot destructure property messages of body"
