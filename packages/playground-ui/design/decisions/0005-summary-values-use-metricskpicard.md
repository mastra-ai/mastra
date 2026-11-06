# 0005: Summary values use MetricsKpiCard

**Decision**: a labelled value the user reads at a glance, such as a credit balance, the current plan, or a period total, is a `MetricsKpiCard` with `.Label` and `.Value`. Several sit side by side in `flex flex-wrap gap-4`.

**Scope**: summary values on overview, billing, and dashboard pages, numeric or not. A `Card` with `CardHeader` and `CardContent` stays the choice for one bounded object with its own actions or tabs.

**Why**: built as `Card` > `CardTitle` > body text, the label renders as a title and the value as body copy, with a title-sized gap between them. The number the user came for reads smaller than its own label, and two cards whose values sit on different rows look misaligned. `MetricsKpiCard` fixes the order, the gap, and the value's role in one place, so every summary on every page matches.

**Evidence**: review of the billing example page on 2026-11-06, which rendered Plan and Credits as `Card` > `CardTitle` > `Txt variant="body"`: "cards / text in cards isnt right". The usage example on the same day, built with `MetricsKpiCard`, needed no change.

**Rejected**: keeping `Card` and raising the value to `display-lg` by hand at each call site, which leaves the label, gap, and padding to each page.

**Approved by**: pending. Proposed after review by Justin Levine (`@jal-co`), 2026-11-06.

**Reaches**: `rg -n "<CardTitle>" packages mastracode` and check each card whose content is a single value.
