---
'@mastra/core': patch
---

fix(workflows): ensure writer.custom() bubbles up from nested workflows and loops

Previously, when using `writer.custom()` in steps within nested sub-workflows or loops (like `dountil`), the custom data events would not properly bubble up to the top-level workflow stream. This fix ensures that custom events are now correctly propagated through the nested workflow hierarchy without modification, allowing them to be consumed at the top level.

This brings workflows in line with the existing behavior for agents, where custom data chunks properly bubble up through sub-agent execution.

**What changed:**
- Modified the `nestedWatchCb` function in workflow event handling to detect and preserve `data-*` custom events
- Custom events now bubble up directly without being wrapped or modified
- Regular workflow events continue to work as before with proper step ID prefixing

**Example:**
```typescript
const subStep = createStep({
  id: 'subStep',
  execute: async ({ writer }) => {
    await writer.custom({
      type: 'custom-progress',
      data: { status: 'processing' }
    });
    return { result: 'done' };
  },
});

const subWorkflow = createWorkflow({ id: 'sub' })
  .then(subStep)
  .commit();

const topWorkflow = createWorkflow({ id: 'top' })
  .then(subWorkflow)
  .commit();

const run = await topWorkflow.createRun();
const stream = run.stream({ inputData: {} });

// Custom events from subStep now properly appear in the top-level stream
for await (const event of stream) {
  if (event.type === 'custom-progress') {
    console.log(event.data); // { status: 'processing' }
  }
}
```
