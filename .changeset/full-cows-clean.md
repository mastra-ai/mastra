---
'@mastra/factory': patch
'@mastra/react': patch
---

Fixed MASTRACODE_ENV_DIR being resolved against the UI source directory instead of the working directory, which made the dev server silently load no environment variables when a relative path was given.
