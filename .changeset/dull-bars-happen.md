---
'@mastra/editor': patch
---

Fixed editor-owned agent instructions failing silently. Agents configured with `editor: { instructions: true }` now throw a clear error instead of running with empty instructions when no published version is available in Studio. This affected agents that were never provisioned, only had a draft version, were deleted, had a published version with no instructions, or hit a storage error while loading. Fixes https://github.com/mastra-ai/mastra/issues/21373

**Before:** the agent ran normally with an empty system prompt.

**After:** resolving or generating with the agent throws until a published version with instructions exists.

```ts
// Agent definition — Studio owns the instructions:
export const agent = new Agent({
  id: 'support-agent',
  editor: { instructions: true },
  model: 'openai/gpt-4o',
});
```

```ts
// Throws until a version is published in Studio:
const agent = client.getAgent('support-agent', { status: 'published' });
await agent.generate('hi');

// Use status: 'draft' to run against the latest draft instead, without publishing:
const draftAgent = client.getAgent('support-agent', { status: 'draft' });
await draftAgent.generate('hi');
```
