---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

Fixed agent network mode failing with "Cannot read properties of undefined" error when tools or workflows don't have an `inputSchema` defined.

**@mastra/core**

- Fixed `getRoutingAgent()` to handle tools and workflows without `inputSchema` by providing a default empty schema fallback

**@mastra/schema-compat**

- Fixed Zod v4 optional/nullable fields producing invalid JSON schema for OpenAI structured outputs
- OpenAI now correctly receives `type: ["string", "null"]` instead of `anyOf` patterns that were rejected with "must have a 'type' key" error
