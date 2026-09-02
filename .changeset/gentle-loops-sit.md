---
'@mastra/react': patch
---

Moved the lucide-react icon dependency to 1.37, in step with the rest of the repo. No API change: the icons ship inside the built bundle and never appear in the published types. Apps pinned to lucide-react 0.x keep working, they just resolve a second copy.
