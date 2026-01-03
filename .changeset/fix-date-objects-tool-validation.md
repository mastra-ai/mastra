---
'@mastra/core': patch
---

Fix tool input validation destroying Date objects

The `convertUndefinedToNull` function in tool input validation was treating `Date` objects as plain objects and recursively processing them. Since `Date` objects have no enumerable properties (`Object.entries(new Date())` returns `[]`), this resulted in empty objects `{}`, which broke `z.coerce.date()` validation.

This fix adds checks to preserve built-in object types (Date, RegExp, Error) before recursive processing. Tools using `z.coerce.date()` can now accept both Date objects and ISO string dates from LLMs without validation errors.

Fixes #11502

