---
'@mastra/memory': patch
'@mastra/core': patch
---

Update MockMemory to work with new storage API changes. MockMemory now properly implements all abstract MastraMemory methods. This includes proper thread management, message saving with MessageList conversion, working memory operations with scope support, and resource listing.

Add Zod v4 support for working memory schemas. Memory implementations now check for Zod v4's built-in `.toJsonSchema()` method before falling back to the `zodToJsonSchema` compatibility function, improving performance and forward compatibility while maintaining backward compatibility with Zod v3.

Add Gemini 3 Pro test coverage in agent-gemini.test.ts to validate the latest Gemini model integration.
