---
'@mastra/code-sdk': patch
---

Fixed `mastracode` crashing on startup after a fresh install. `@mastra/code-sdk` now requires `@mastra/core` 1.84 or newer, the first version with the knowledge scope helpers it imports. Before, npm could install `@mastra/core` 1.83, and `mastracode --help` failed with "does not provide an export named 'encodeKnowledgeScopeId'".
