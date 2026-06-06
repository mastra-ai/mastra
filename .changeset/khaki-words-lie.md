---
'@mastra/core': patch
---

Fixed BM25 tokenizer dropping CJK/non-Latin characters by replacing ASCII-only `\w` regex with Unicode-aware `\p{L}\p{N}` pattern. Added `tokenizer` function to `TokenizeOptions` for custom tokenization (e.g. n-gram, kuromoji). Workspace now forwards `tokenize` options to SearchEngine, enabling CJK-aware search configuration.

**Before:** Japanese, Chinese, Korean, Arabic, and other non-Latin text was silently destroyed by the default `removePunctuation` step, producing empty BM25 search results.

**After:** Non-Latin characters are preserved by default. Users can also plug in a custom tokenizer:

```ts
new Workspace({
  bm25: {
    tokenize: {
      tokenizer: myCustomCjkTokenizer,
    },
  },
});
```

Fixes #17636
