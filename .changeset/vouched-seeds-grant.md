---
'@mastra/core': patch
---

Knowledge access evaluation now treats host-vouched scopes as grant eligibility only, not as implicit read access. A vouched scope becomes readable only through an ordinary grant, such as the self-owner grant that built-in `org`, `resource`, and `thread` scope types create. Declared structure scopes whose addresses match a scope type now receive that type's creation-template grants, matching lazily materialized scopes.
