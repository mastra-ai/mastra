---
'@mastra/server': patch
---

Let `PATCH /memory/threads/:threadId` clear a thread title.

The handler distinguished "field absent" from "field present" with a falsy check
(`title: title || thread.title`), so `{ "title": "" }` returned 200 with the old
title still stored, and callers had no way to tell that apart from a successful
write. It now checks for `undefined`, which is already how the body schema says
"leave this field alone" — both fields are `.optional()`. Callers that omit a
field are unaffected. `metadata` gets the same treatment for consistency; its
behavior is unchanged, since `{}` is truthy.
