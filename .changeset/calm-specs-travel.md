---
'@mastra/client-js': minor
'@mastra/react': patch
---

Added `@mastra/client-js/gen-ui`, a framework-free Generative UI core. It holds the spec tool protocol, spec resolution, validation, and action runtime that `@mastra/react/gen-ui` now builds on, so you can read the UI specs an agent produced in a stored thread outside React — for example on a server that posts them to Slack. Spec calls, edits, and streamed `data-spec` parts resolve the same way they do in the browser.

```ts
import { createGenUIDefinition, createSpecResolver } from '@mastra/client-js/gen-ui';

const definition = createGenUIDefinition({ catalog, specTool: true });
const resolver = createSpecResolver({ specTool: definition.specTool });

const { messages } = await client.getMemoryThread({ threadId, agentId }).listMessages();
resolver.update(messages);
const read = resolver.specForCall(toolCallId);
if (read?.spec) await postToSlack(read.spec);
```

`createSpecTools` builds the spec tool and its edit tool from the same definition. The edit tool takes everything it needs in its execute context, `{ toolCallId, messages }`, so it finds the interface it edits in the conversation you pass rather than in state held elsewhere.

`@json-render/core` is an optional peer dependency, needed only when you import `@mastra/client-js/gen-ui`. The `@mastra/react/gen-ui` API is unchanged.

Fixed the spec edit tool telling the model `interface "undefined" is not complete yet` when it edited an interface that was still streaming. The error now names that interface.
