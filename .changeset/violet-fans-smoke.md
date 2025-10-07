---
"@mastra/agent-builder": patch
"@mastra/core": patch
"@mastra/memory": patch
"@mastra/server": patch
---

Fix TypeScript errors with provider-defined tools by updating ai-v5 and openai-v5 to matching provider-utils versions. This ensures npm deduplicates to a single provider-utils instance, resolving type incompatibility issues when passing provider tools to Agent.
