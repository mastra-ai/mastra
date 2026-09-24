---
'@mastra/core': patch
---

Fixed a denial-of-service risk in dataset schema validation. Regex `pattern` and `patternProperties` in dataset input and ground truth schemas now run on a linear-time (RE2) engine, so a crafted pattern can no longer freeze the server. Fixes #24981.

**Behavior changes**

- Patterns using syntax RE2 cannot run, such as lookarounds (`(?=...)`, `(?<!...)`) and backreferences (`\1`), are rejected with a `DATASET_SCHEMA_PATTERN_UNSUPPORTED` error when the dataset is created or its schema is updated. Escapes such as `\uXXXX` and `\cX` keep working.
- Matching is Unicode-aware: `.` matches a whole code point (so `^.$` matches `😀`), and `\p{L}` is a Unicode class even without the `u` flag.

To migrate, rewrite affected patterns without lookarounds or backreferences, for example replace `pattern: '^(?=.*\\d).+$'` with `pattern: '\\d'`, then update the dataset schema.
