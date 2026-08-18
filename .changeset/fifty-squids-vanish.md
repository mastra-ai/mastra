---
'@mastra/memory': patch
---

Added `memory.settled()`, which waits for background memory work to finish. Observational memory runs observation and reflection cycles in the background after an agent run returns, and those cycles kept writing to the database after callers had closed their storage connection. Await `memory.settled()` before closing a store you own. Fixed the observational memory reflector repeating compression attempts that could not succeed: it now stops as soon as an attempt returns the same result as the previous one, instead of always working through the full retry ladder. This cuts the model calls and database statements a single reflection produces. Fixes #21617
