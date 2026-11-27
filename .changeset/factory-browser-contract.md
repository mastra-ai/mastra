---
'@mastra/factory': patch
---

Factory's browser-safe types and board helpers (default board, busy-card rule, intake order, card labels, people, change requests, source filters, rules, audit actors) now come from an internal package that Factory bundles. No change to Factory's behavior. This lets Factory's client and UI packages share the same code without installing Factory's server dependencies.
