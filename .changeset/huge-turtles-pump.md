---
'@mastra/factory': patch
---

Added `scope=org` to `GET /web/config/models`. It lists only the models your organization credentials can run, next to the existing `scope=user` for personal credentials.

```text
GET /web/config/models?scope=org
```

An unsupported `scope` value now returns `400` with `invalid_model_scope`. Before, it was ignored and the unfiltered list came back.
