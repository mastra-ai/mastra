This is NOT the Mastra you know. Its APIs, conventions, and file structure have changed since your training data, so don't write Mastra code from memory.
Before writing code, load the `mastra` skill if it's available, then read the relevant docs in `node_modules/@mastra/<package>/dist/docs/` (start at `SKILL.md`). Follow deprecation notices.

Register agents, tools, workflows, and scorers in `src/mastra/index.ts`.
Use the `dev` and `build` scripts in `package.json`, not `mastra dev` or `mastra build` directly.
