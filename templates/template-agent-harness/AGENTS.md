# This is NOT the Mastra you know

Mastra changes fast. Its APIs, conventions, and file structure have likely changed since your training data, so don't write Mastra code from memory. Load the `mastra` skill first if it's available. Then check the bundled docs in `node_modules/@mastra/*/dist/docs/` or https://mastra.ai/llms.txt before you write code. Follow deprecation notices.

Register agents, tools, workflows, and scorers in `src/mastra/index.ts`.
Use the `dev` and `build` scripts in `package.json`, not `mastra dev` or `mastra build` directly.
