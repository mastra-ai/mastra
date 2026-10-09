---
'@mastra/server': patch
---

Fixed custom routes registered with `requiresAuth: false` returning 401 when a protected pattern such as `/*` matched them. Public custom routes now bypass auth as declared, while routes with `requiresAuth: true` still require authentication.
