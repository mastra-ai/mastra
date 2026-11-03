---
'@mastra/core': patch
---

Knowledge tool results now name each page by the ref `knowledge_read` accepts. Search, read and page results carry `ref`: the scope address for a scope page, the full key path for a nested page (`docs:acme#guides/observability/logging`), or the page id when a page on the path has no key. The old `key` field held only the last path segment, so agents that copied it got "not found" for nested pages; it is gone. A read that misses now lists up to three close matches by ref, and an ambiguous page name lists its candidates by ref.
