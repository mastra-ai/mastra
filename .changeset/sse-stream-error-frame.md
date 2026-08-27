---
'@mastra/server': patch
---

Server adapters can now signal a client-visible error when a stream breaks mid-response, instead of the connection just cutting off. Added `buildStreamErrorFrame` and `buildStreamDoneFrame` to `@mastra/server/server-adapter` for adapters to send a `type: 'error'` frame plus a final `[DONE]` marker when the underlying stream rejects after some data was already sent.

**Example**

```ts
import { buildStreamErrorFrame, buildStreamDoneFrame } from '@mastra/server/server-adapter';

try {
  await pipeSourceToClient(source, stream);
} catch (error) {
  logger.error('stream failed mid-response', { error });
  // Tell the client the stream broke, then close it cleanly.
  await stream.write(buildStreamErrorFrame(error, 'sse'));
  const doneFrame = buildStreamDoneFrame('sse');
  if (doneFrame) await stream.write(doneFrame);
}
```
