---
'@internal/core': patch
'@mastra/core': patch
---

Fixed `RequestContext.toJSON()` to skip primitive BigInt values that cannot be serialized to JSON, while preserving BigInts with a working custom JSON serializer.

BigInt values without a working `toJSON()` are filtered before an outer `JSON.stringify` replacer runs, matching the existing handling of nested BigInts.
