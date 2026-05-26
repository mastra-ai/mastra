---
'mastracode': patch
---

Mastra Code's `ask_user` interactive picker now wraps long option labels across multiple rows with a `↳` continuation marker, instead of truncating them at the box edge. Mirrors fzf's `--wrap` design: arrow keys still navigate item-to-item (not row-to-row), so picking remains predictable when options span multiple lines. Follow-up to the crash fix in #17005 — the picker UX gap noted by @Doddle-BE on #17002.
