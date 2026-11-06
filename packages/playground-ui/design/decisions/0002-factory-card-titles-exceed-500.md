# 0002: Factory card titles exceed the 500 weight ceiling

**Decision**: text weight stops at 500 everywhere in a product surface, except the three Factory card-title roles: `card-title` and `card-title-tight` at 550, and `card-title-strong` at 600.

**Scope**: Factory work-item and candidate titles. Every other title, label, and KPI value keeps a role at 500 or below. A new surface does not use these roles to get bold text.

**Why**: hierarchy comes from size and tone, so a general weight ceiling keeps screens calm. Factory's card titles already carried heavier weights when they moved into shared roles, and the move was meant to keep their look, not change it.

**Evidence**: PR [#25784](https://github.com/mastra-ai/mastra/pull/25784), commit `f02e2f5`: "Factory card titles keep their existing appearance. Their complete text styles now live in `Txt` instead of local font weights and inherited tracking." The roles are in `theme/typography.css`, whose header comment states the exception.

**Rejected**: forcing the titles to 500, which would have changed Factory's existing emphasis in a change meant only to move styles into roles.

**Approved by**: merged in #25784, 2026-10-02.

**Reaches**: `rg "card-title" packages mastracode`
