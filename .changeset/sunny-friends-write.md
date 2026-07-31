---
'@mastra/core': patch
---

Fixed `RegexFilterProcessor` leaving part of a matched value in the output when two rules match overlapping text.

**What was wrong**

Rules were applied one at a time with `String.replace`, so an earlier rule could consume the start of a longer match and leave the rest in the clear. With the `pii` preset, `phone` runs before `credit-card`, so a card number written without separators lost only its first ten digits:

```ts
const filter = new RegexFilterProcessor({ presets: ['pii'], strategy: 'redact' });

// Before: "card [PHONE]111111"
// After:  "card [CREDIT_CARD]"
```

Overlapping matches are now combined into one region and replaced once, using the replacement of the longest match.

**Two smaller changes to redaction**

- A replacement that references capture groups (`$1`, `$&`) now falls back to the replacement string as written when the rule cannot match the text it matched in isolation, which happens with a lookbehind or lookahead. The region is still redacted.
- A rule that only matches empty strings no longer inserts its replacement between every character.
