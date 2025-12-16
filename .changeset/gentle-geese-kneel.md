---
'@mastra/core': patch
---

Fix OpenRouter type incompatibility by adding ai-v5 to devDependencies

When `ai-v5` was removed from dependencies in PR #10989, pnpm started resolving `@openrouter/ai-sdk-provider`'s peer dependency on `ai` to v6 beta instead of v5. This caused a type mismatch because v6 beta uses `@ai-sdk/provider@3.0.0-beta.26` (with `type: "provider"`) while v5 uses `@ai-sdk/provider@2.0.0` (with `type: "provider-defined"`).

Adding `ai-v5` as a devDependency ensures pnpm resolves OpenRouter's peer dependency to the stable v5 version.
