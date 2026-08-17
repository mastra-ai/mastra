---
'@mastra/core': patch
---

Refactor MastraCompositeStore domain wiring to be data driven. The constructor resolve block and the init roll call previously enumerated every storage domain by hand, so a domain registered in the stores map but missing from either list was silently skipped: init reported success while the domain's tables were never created. Both lists are now replaced by iteration over a typed DOMAIN_KEYS constant with a compile time exhaustiveness guard, and a conformance test proves a newly registered domain cannot dodge init. DOMAIN_KEYS is a new exported constant, following the existing EDITOR_DOMAINS pattern. No behavior change for the existing domains, with two narrow carve outs: a stores map entry without an init function is now skipped during init instead of throwing a TypeError, and an entry present in the stores map that the old roll call never named now gets initialized.
