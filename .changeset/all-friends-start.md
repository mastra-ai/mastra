---
'@mastra/editor': minor
'@mastra/server': minor
'@mastra/core': minor
'mastra': patch
---

Added the Studio Workflow Builder backend. Configure the editor with the new `workflowBuilder` option to enable a hidden, editor-owned agent that authors persisted workflow definitions:

```ts
import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';

const mastra = new Mastra({
  editor: new MastraEditor({
    workflowBuilder: {
      enabled: true,
      model: 'openai/gpt-5.5', // optional, this is the default
      lastMessages: 100, // optional, raise or lower how much authoring history the agent recalls
    },
  }),
});
```

The server exposes two new endpoints for it: `GET /editor/workflow-builder/settings` reports availability and the admin model policy, and `POST /editor/workflow-builder/stream` streams responses from the builder agent. Access is gated by the `stored-workflows:read` and `stored-workflows:write` permissions, and roles granting `stored-resources` now expand to cover stored workflows. Also exported `validateToolInput` from `@mastra/core/tools` for validating input against a tool schema.
