---
'@mastra/core': patch
---

Address post-merge review follow-ups from the evented-workflow serialization work:

- `Mastra` now logs a warning when the TTL sweep evicts a run-scoped workflow that was still registered, surfacing abandoned suspended runs instead of dropping them silently.
- The `RegExp` codec's `// lgtm[js/regex-injection]` suppression now spells out all three structural gates (`isEnvelope` length cap + flag whitelist, local re-narrowing in `decodeRegExpEnvelope`, `try/catch` fallback) at the suppression site so future readers don't reintroduce escaping.
- The `evented-unix-pubsub` scenario test now allocates its Unix socket under a short `/tmp/aim-*` directory instead of `os.tmpdir()` so it stays under the macOS 104-byte `sun_path` limit.
