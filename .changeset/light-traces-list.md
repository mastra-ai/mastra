---
"@mastra/core": patch
"@mastra/server": patch
"mastra": patch
---

Update observability trace listing so `mastra api trace list` uses lightweight trace rows by default and supports `--verbose` to fetch the full root span payloads.

Expose `GET /observability/traces/light` from the OSS server and storage layer so local servers and hosted observability provide the same lightweight trace-list API.
