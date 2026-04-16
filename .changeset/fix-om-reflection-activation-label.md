---
'mastracode': patch
---

Fix misleading observational-memory activation marker label in the MastraCode TUI. Reflection activations no longer claim to remove message tokens — they compress the observation pool in place, so the marker now renders as `✓ Activated reflection: <before> → <after> obs tokens (-<delta>)`. Observation activations continue to render with the `-X msg tokens, +Y obs tokens` form.
