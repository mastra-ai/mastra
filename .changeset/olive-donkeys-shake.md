---
'@internal/playground': patch
---

Fixed the Agent Builder save flow showing a raw HTTP error instead of the admin's model-policy message.

When an admin's model policy blocks the model an agent is being saved with, the server replies with HTTP 422 and a `MODEL_NOT_ALLOWED` code. Studio looked for that code on the wrong part of the error, so the toast always fell back to the generic message:

**Before**

```
Failed to save agent: HTTP error! status: 422 - {"error":{"code":"MODEL_NOT_ALLOWED","message":"gpt-4o is not allowed by policy"}}
```

**After**

```
gpt-4o is not allowed by policy
```
