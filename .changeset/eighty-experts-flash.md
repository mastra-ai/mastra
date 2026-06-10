---
'mastra': patch
---

Fixed `mastra dev --https` crashing on Node.js 22 by replacing unmaintained `@expo/devcert` with `selfsigned` for development certificate generation
