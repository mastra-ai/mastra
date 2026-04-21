---
'@mastra/memory': patch
---

fix(memory): surrogate-safe string truncation prevents Anthropic JSON parse errors

Observational memory truncation used `str.slice(0, n)` which operates on UTF-16 code units. When the cut lands between a surrogate pair (emoji outside the BMP like 🔥🎭😄), the resulting string contains an unpaired high surrogate. Anthropic's JSON parser strictly validates UTF-16 and rejects the body with "no low surrogate in string".

Fixed by checking whether the last code unit before the cut is a high surrogate (U+D800–U+DBFF) and backing off by one position when it is. Applied to all three truncation sites in the memory package:

- `truncateStringByTokens()` (tool-result-helpers.ts)
- `maybeTruncate()` (observer-agent.ts)
- `sanitizeObservationLines()` (observer-agent.ts)

Fixes #15573
