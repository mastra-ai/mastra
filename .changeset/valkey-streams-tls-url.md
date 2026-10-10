---
'@mastra/valkey-streams': patch
---

Fixed `ValkeyStreamsPubSub` connecting without TLS when given a `rediss://` or `valkeys://` URL. TLS-only endpoints such as AWS ElastiCache with in-transit encryption now connect from the URL alone; an explicit `valkeyOptions.useTLS` still takes precedence.
