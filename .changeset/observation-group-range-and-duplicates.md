---
'@mastra/memory': patch
---

Observation groups no longer lose their identity or span an inverted range when reflected. `combineObservationGroupRanges` took the first segment's start and the last segment's end by array position, so groups that were not already in ascending order produced a backwards range such as `10:5`, which `reconcileObservationGroupsFromReflection` then persisted. It now spans the lowest start to the highest end, and falls back to listing distinct segments when a range is not numeric. Separately, `renderObservationGroupsForReflection` keyed its lookup by group content, so two groups holding identical text collapsed onto one id and range and the other group's provenance was dropped; groups are now consumed in document order.
