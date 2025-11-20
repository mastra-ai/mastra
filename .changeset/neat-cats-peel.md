---
'@mastra/core': patch
---

Fix providerMetadata preservation for Gemini function calls

- Convert stream chunks directly to MastraMessageV2 format in loop steps to preserve providerMetadata
- Add message-level providerMetadata support to MastraMessageContentV2 and V3 types
- Fix sanitizeV5UIMessages filtering to match original 0.x behavior
- Hydrate threadId and resourceId from memoryInfo when missing
- Update test utilities for 0.x compatibility
