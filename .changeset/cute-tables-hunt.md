---
'mastra': minor
---

Added the `mastra factory dev` command to start a local development server for Agent Builder development. It uses the same dev runtime and flags as `mastra dev` and shares the same `.mastra` output directory and dev lock, so the two commands cannot run at the same time in the same project.
