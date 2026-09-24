---
'@mastra/core': patch
---

Fixed channel threads getting permanently stuck after a tool call suspended on adapters that cannot show approval buttons. With `toolDisplay: 'hidden'`, runs now auto-resume suspended tools on platforms without interactive buttons (for example SMS, iMessage or custom gateways). Set the new `approvalButtons` adapter option to override the detection. Inbound messages that don't start a run are now logged at warn level instead of being dropped silently.

```ts
channels: {
  adapters: {
    imessage: { adapter: imessageAdapter, toolDisplay: 'hidden' }, // now auto-resumes
    custom: { adapter: customAdapter, toolDisplay: 'hidden', approvalButtons: true },
  },
}
```
