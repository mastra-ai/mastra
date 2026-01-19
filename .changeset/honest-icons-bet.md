---
'@mastra/google-cloud-pubsub': major
'@mastra/agent-builder': major
'@mastra/client-js': major
'@mastra/observability': major
'@mastra/ai-sdk': major
'@mastra/inngest': major
'@mastra/server': major
'@mastra/core': major
---

**Breaking Change**: Convert OUTPUT generic from `OutputSchema` constraint to plain generic

This change removes the direct dependency on Zod typings in the public API by converting all `OUTPUT extends OutputSchema` generic constraints to plain `OUTPUT` generics throughout the codebase. This is preparation for moving to a standard schema approach.

- All generic type parameters previously constrained to `OutputSchema` (e.g., `<OUTPUT extends OutputSchema = undefined>`) are now plain generics with defaults (e.g., `<OUTPUT = undefined>`)
- Affects all public APIs including `Agent`, `MastraModelOutput`, `AgentExecutionOptions`, and stream/generate methods

- `InferSchemaOutput<OUTPUT>` replaced with `OUTPUT` throughout
- `PartialSchemaOutput<OUTPUT>` replaced with `Partial<OUTPUT>`
- Schema fields now use `NonNullable<OutputSchema<OUTPUT>>` instead of `OUTPUT` directly

- Added `FullOutput<OUTPUT>` type representing complete output with all fields
- Added `AgentExecutionOptionsBase<OUTPUT>` type
- `getFullOutput()` method now returns `Promise<FullOutput<OUTPUT>>`

- `Agent` class now generic: `Agent<TAgentId, TTools, TOutput>`
- `agent.generate()` and `agent.stream()` methods have updated signatures
- `MastraModelOutput<OUTPUT>` no longer requires `OutputSchema` constraint
- Network route and streaming APIs updated to use plain OUTPUT generic

**Before:**

```typescript
const output = await agent.generate<z.ZodType>([...], {
  structuredOutput: { schema: mySchema }
});

**After:**
const output = await agent.generate<z.infer<typeof mySchema>>([...], {
  structuredOutput: { schema: mySchema }
});
// Or rely on type inference:
const output = await agent.generate([...], {
  structuredOutput: { schema: mySchema }
});

```
