---
'mastra': patch
---

Harden agent builder starter and form snapshot rendering: guard the starter submit while builder settings load so the resolved model policy is always applied, treat whitespace-only field values as empty in the per-field snapshot directives so the builder knows to fill them, and sanitize interpolated snapshot values so user-supplied names or descriptions cannot inject directive-like lines into the snapshot.
