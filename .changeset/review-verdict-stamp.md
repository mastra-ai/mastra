---
'@mastra/factory': patch
---

A Done card now says when its review asked for changes.

Both verdicts rest the card in Done — the review pass is over either way — so an approved PR and one waiting on its author looked identical. The review seat's terminal transition now requires a `verdict` (`approve` or `request_changes`), stamped on the card in the same commit that rests it; a card whose review requested changes wears a **Changes requested** mark in Done. Unmarked Done stays the normal good outcome, and the next review pass rewrites the stamp.
