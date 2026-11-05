---
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/inngest': patch
---

Fixed TypeScript errors with zod v3 schemas and newer `ai` v7 messages.

- zod v3 schemas now type-check in `createStep(agent, { structuredOutput })` and the workflow `.agent()` step, and in `defaultOptions.structuredOutput`. With a zod v3 `output` schema, `generateLegacy` now types `result.object` from the schema. In client-js, `agent.generate()`/`stream()` with a zod v3 `structuredOutput` schema no longer fails with "union type that is too complex to represent". See [#29574](https://github.com/mastra-ai/mastra/issues/29574).
- `UIMessage[]` from newer `ai` v7 releases, which can include part types like `steering-message` from `ai@7.0.163`, can now be passed to `agent.generate()` and `agent.stream()`. Mastra does not process these new part types yet. See [#29575](https://github.com/mastra-ai/mastra/issues/29575).
