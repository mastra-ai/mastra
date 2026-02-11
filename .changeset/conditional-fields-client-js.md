---
'@mastra/client-js': minor
---

Added `requestContextSchema` to stored agent types and replaced local conditional field type definitions with re-exports from `@mastra/core/storage` (`Rule`, `RuleGroup`, `StorageConditionalVariant`, `StorageConditionalField`). Existing type aliases (`StoredAgentRule`, `StoredAgentRuleGroup`, `ConditionalVariant`, `ConditionalField`) are preserved for backward compatibility.
