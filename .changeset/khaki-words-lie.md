---
'@mastra/core': patch
---

Improved BM25 tokenization to support CJK (Japanese, Chinese, Korean) and other non-Latin languages. Added `TokenizeOptions.tokenizer` for plugging in custom tokenizers (e.g. n-gram, kuromoji). Workspace `bm25` config now accepts `tokenize` options for full control over how text is split into search tokens.

**Before:** BM25 search returned no results for non-English content — CJK characters were silently stripped during tokenization.

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
