---
'mastra': patch
---

Fixed deployment region selection to be flag-only, using the default region, `us`, when the flag is omitted and leaving existing environments unchanged.

Previously, `mastra deploy` could prompt for a region when creating an environment or Factory project. To keep choosing EU placement, pass the flag explicitly:

```bash
mastra deploy --region eu
```
