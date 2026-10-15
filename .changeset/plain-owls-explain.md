---
'@mastra/factory': patch
---

Factory model-policy refusals such as "Factory session ownership is unavailable." now name the refused resource id, its kind, the thread, the caller and the reason, so server logs show which surface sent the request.
