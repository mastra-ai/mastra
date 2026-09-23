---
'@mastra/inngest': patch
---

Fixed a type error when an Inngest workflow and its first step share an input schema that uses `.default()`. `init().createWorkflow` now infers its input from the schema's output shape, matching `createStep` and `@mastra/core`'s `createWorkflow`, so `.then(step)` compiles again.

```ts
const InputSchema = z.object({ dryrun: z.boolean().optional().default(false) });

const step = createStep({ id: 'first', inputSchema: InputSchema, outputSchema, execute });
createWorkflow({ id: 'wf', inputSchema: InputSchema, outputSchema }).then(step); // no longer errors
```
