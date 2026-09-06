---
'@mastra/memory': patch
---

Fixed Observational Memory to forward only images and PDFs to the observer by default.

**Before:** Omitting `observeAttachments` forwarded every attachment type.

**After:** Omitting `observeAttachments` forwards images and PDFs. To retain the previous behavior and forward every attachment type, explicitly set `observeAttachments: true`:

```ts
new ObservationalMemory({
  observation: {
    observeAttachments: true,
  },
});
```
