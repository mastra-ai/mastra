# 0006: Peer headings share one role

**Decision**: section headings at the same depth of one page use the same component and text role.

**Scope**: in-page section headings below the `PageHeader`. Headings inside a card, dialog, or panel are a level down and follow their own component.

**Why**: size is how a reader tells a parent from a child. A 12px `column` label beside a 14px `SettingsTitle` makes two sections that are peers look like a heading and its subheading.

**Evidence**: review of the billing example page on 2026-11-06, where "Plan and credits" (`Txt variant="column"`) sat above "Usage this period" (`SettingsTitle`): "diff sizes?".

**Rejected**: keeping `column` for sections without a surface and `SettingsTitle` for settings groups on the same page, which is what produced the mismatch.

**Approved by**: pending. Proposed after review by Justin Levine (`@jal-co`), 2026-11-06.

**Reaches**: pages that render both `variant="column"` on an `h2` and `SettingsTitle`: `rg -l 'as="h2"[^>]*variant="column"' packages mastracode | xargs rg -l SettingsTitle`
