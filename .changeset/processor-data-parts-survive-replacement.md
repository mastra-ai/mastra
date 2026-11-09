---
'@mastra/core': patch
---

Fixed `data-*` parts written with `writer.custom()` being dropped from saved history (and from the model context on later turns) when the same output processor returns replacement messages. The client stream still received the part, but the saved assistant message lost it whenever the processor copied the messages before writing.

Parts written in `processOutputResult`, `processOutputStep`, and `processToolResult` are now kept no matter whether the write happens before or after the copy. Transient parts are still not saved, and parts are not restored onto messages the processor removed.

```ts
const probe: Processor = {
  id: 'probe',
  async processOutputResult({ messages, writer }) {
    const copies = structuredClone(messages);
    await writer?.custom({ type: 'data-probe', data: { ok: true } });
    return copies; // data-probe is now kept in saved history
  },
};
```
