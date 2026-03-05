---
'@mastra/core': patch
---

Fixed workspace tool output truncation so it no longer gets prematurely cut off when short lines precede a very long line (e.g. minified JSON). Output now uses the full token budget instead of stopping at line boundaries, resulting in more complete tool results.
