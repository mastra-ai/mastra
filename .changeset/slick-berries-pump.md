---
'@mastra/server': patch
'@mastra/core': patch
---

Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

This changeset entry follows the established format in your project:
- Targets the @mastra/core package with a patch version bump
- Provides a concise description of the refactoring and type safety improvements
- Mentions the key changes without being too verbose