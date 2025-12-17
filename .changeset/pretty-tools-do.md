---
'mastra': patch
---

Two smaller quality of life improvements:

- The default `create-mastra` project no longer defines a LibSQLStore storage for the weather agent memory. It uses the root level `storage` option now (which is memory). This way no `mastra.db` files are created outside of the project
- When running `mastra init` inside a project that already has git initialized, the prompt to initialize git is skipped
