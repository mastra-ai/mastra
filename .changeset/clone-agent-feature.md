---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground-ui': minor
---

Add clone agent feature. Code-defined or stored agents can be cloned into new stored agents via `POST /agents/:agentId/clone`. The clone serializes the agent's resolved config (model, instructions, tools, workflows, memory, etc.) using the provided `requestContext` and saves it as a new stored agent.

Also replaces `@sindresorhus/slugify` in `@mastra/server` with a lightweight inline `toSlug` helper to avoid ESM-only transitive dependency issues in dev mode.
