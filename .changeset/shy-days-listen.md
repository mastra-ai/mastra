---
'mastra': patch
---

Fixed the CLI build skipping the embedded Studio UI's prebuild step, which could leave the bundled dev UI referencing an outdated version of the playground UI package.
