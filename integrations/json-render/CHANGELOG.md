# @mastra/json-render

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/json-render`, which lets agents compose [json-render](https://json-render.dev) interfaces from your component catalog. ([#29914](https://github.com/mastra-ai/mastra/pull/29914))

  ```ts
  import { JsonRenderProcessor } from '@mastra/json-render';

  const ui = new JsonRenderProcessor({ catalog });

  const agent = new Agent({
    id: 'ui-agent',
    name: 'UI Agent',
    model: 'openai/gpt-6.1-sol',
    instructions: catalog.prompt({ mode: 'inline', editModes: ['patch'] }),
    inputProcessors: [ui],
    outputProcessors: [ui],
    maxProcessorRetries: 2,
    memory: new Memory(),
  });
  ```

  - Interfaces the model writes stream to the client as `data-spec` parts, and the reply's text keeps only the prose. Render them with `useJsonRenderMessage()` from `@json-render/react`.
  - Interfaces are saved with the message, so they render again after a reload.
  - Later turns can edit the latest interface with a few patches. Send the interface's state under the `JSON_RENDER_STATE` request context key, and the model sees what the user set and the edit keeps it.
  - Interfaces that don't match the catalog are sent back to the model to fix before they're saved.

### Patch Changes

- Updated dependencies [[`88b4a97`](https://github.com/mastra-ai/mastra/commit/88b4a970426f48731a153e46ed228d0301da32a1), [`33eaa29`](https://github.com/mastra-ai/mastra/commit/33eaa293e28aa8cd86ad68e1eaf44b4929be818d), [`c8a35ac`](https://github.com/mastra-ai/mastra/commit/c8a35ac6243eaef8ef1d9e589a7b75bf44904d8b)]:
  - @mastra/core@1.84.0-alpha.3
