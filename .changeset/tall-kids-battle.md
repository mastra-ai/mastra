---
'@mastra/playground-ui': patch
---

The chat `send` function from `useChatSend` can now return a promise. It resolves to `false` when the server can't have stored the message, for example when it refused a request that was too large, so a composer can restore the text and attachments it had cleared:

```tsx
const send = useChatSend();

const submit = async () => {
  const draft = { message: text, attachments };
  clearComposer();
  const delivered = await send(draft);
  if (delivered === false) restoreComposer(draft);
};
```
