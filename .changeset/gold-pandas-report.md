---
'@mastra/memory': patch
---

Log discarded degenerate observer/reflector output so failures are diagnosable. When observational memory's degenerate-repetition detector trips, the raw model output was previously thrown away — the error "Observer produced degenerate output after retry" gave no way to tell a real repetition loop apart from a detector false-positive on legitimately repetitive content. Detection sites now log bounded diagnostics (length, duplicate-window ratio, most-repeated window, head/tail snippets) to the OM debug log, and the thrown observer errors include a compact version of the same diagnostics.
