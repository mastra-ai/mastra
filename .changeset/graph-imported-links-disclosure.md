---
'@mastra/factory': patch
---

**Added** an `importedLinks` field to the Knowledge graph response. It reports when importer-provided relationships are left out of the graph and why: budget limits, a retired importer binding, an ambiguous match, or storage that cannot serve importer claims. A graph that omits importer relationships is no longer silent about it; complete graphs return `importedLinks.complete: true` and are otherwise unchanged.
