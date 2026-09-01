---
'@mastra/factory': patch
---

Fixed repository-local Factory skills not loading when the bundled skills exist. Factory now layers the consumer repo's src/mastra/public/factory-skills directory over the bundled Factory skills, so projects can add custom pipeline skills (or override built-in ones) without patching node_modules. The local skills root is also resolved correctly for the cwd variants used by mastra factory dev --dir src/mastra. Fixes #22707.
