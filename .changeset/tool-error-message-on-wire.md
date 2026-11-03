---
'@mastra/server': patch
---

Errors in streamed chunks now keep their message. This covers tool errors and run errors: any chunk whose `payload.error` is an Error. An error whose `name` was set (for example `Knowledge page "…" not found.`) used to reach clients as `{ "name": "Error" }` with no message; it now arrives as `{ "name", "message" }`. An error class with its own `toJSON` (such as `MastraError`) keeps the shape it chooses, plus its message. Stacks are no longer sent, including for errors that used to carry one.
