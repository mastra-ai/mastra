---
"@mastra/core": patch
---

Add InferUITools and related type helpers for AI SDK compatibility

Adds new type utility functions to help with type inference when using Mastra tools with the AI SDK's UI components:
- `InferUITools` - Infers input/output types for a collection of tools
- `InferUITool` - Infers input/output types for a single tool

These type helpers allow developers to easily integrate Mastra tools with AI SDK UI components like `useChat` by providing proper type inference for tool inputs and outputs.
