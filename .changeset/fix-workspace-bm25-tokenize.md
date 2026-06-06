---
'@mastra/core': patch
---

fix(workspace): forward `bm25.tokenize` to SearchEngine so CJK and other non-Latin content is searchable

`Workspace` built its internal `SearchEngine` only forwarding `k1`/`b` from `config.bm25`, silently dropping any `tokenize` field. The default tokenizer uses `\w`-based patterns that strip CJK characters, making Japanese/Chinese/Korean content effectively unsearchable.

The `WorkspaceConfig.bm25` type is now `boolean | (BM25Config & { tokenize?: TokenizeOptions })` and the `tokenize` value is forwarded to `SearchEngine`'s `bm25.tokenize` config on construction.
