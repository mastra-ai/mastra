---
'@mastra/core': major
'@mastra/inngest': major
'@mastra/memory': major
'@mastra/evals': major
'@mastra/mcp': major
'@mastra/rag': major
'@mastra/agent-builder': major
---

Refactor workflow and tool types to remove Zod-specific constraints

Removed Zod-specific type constraints across all workflow implementations and tool types, replacing them with generic types. This ensures type consistency across default, evented, and inngest workflows while preparing for Zod v4 migration.

**Workflow Changes:**

- Removed `z.ZodObject<any>` and `z.ZodType<any>` constraints from all workflow generic types
- Updated method signatures to use `TInput` and `TState` directly instead of `z.infer<TInput>` and `z.infer<TState>`
- Aligned conditional types across all workflow implementations using `TInput extends unknown` pattern
- Fixed `TSteps` generic to properly use `TEngineType` instead of `any`

**Tool Changes:**

- Removed Zod schema constraints from `ToolExecutionContext` and related interfaces
- Simplified type parameters from `TSuspendSchema extends ZodLikeSchema` to `TSuspend` and `TResume`
- Updated tool execution context types to use generic types

**Type Utilities:**

- Refactored type helpers to work with generic schemas instead of Zod-specific types
- Updated type extraction utilities for better compatibility

This change maintains backward compatibility while improving type consistency and preparing for Zod v4 support across all affected packages.
