---
'@mastra/loggers': patch
---

Fix `UpstashTransport` sending `LTRIM` as part of the `LPUSH` command

Upstash's `/pipeline` endpoint runs one Redis command per inner array. The
transport appended `LTRIM` and its arguments to the `LPUSH` array and sent
the result as a single pipeline command, so only `LPUSH` ever ran: the log
list was never trimmed to `maxListLength`, and `LTRIM`, the list name and
the numeric bounds were stored as additional log records.

`LTRIM` is now sent as its own pipeline command.
