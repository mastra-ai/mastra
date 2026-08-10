---
'@mastra/core': patch
---

Stop the browser-safe `@mastra/core/a2a/client` entry from pulling in the Node `module` builtin, which broke `@mastra/client-js` in browser bundles (`Module not found: Can't resolve 'module'` in Next.js).
