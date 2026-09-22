---
'mastracode': patch
---

**Board filters are chips now**

The board header's search box, teammate combobox, relevance dropdown and label picker are gone, replaced by the same filter bar the Studio traces list uses. Type and press Enter and the text commits as a `Text contains …` chip; `Teammate` is one arrow below it, each name behind its avatar; labels gather into one chip.

`Relevant because` no longer sits there disabled — it only appears once a teammate is picked, because it filters nothing on its own. Re-picking a dimension replaces its chip instead of stacking a second one, and an empty relevance selection now means no relevance filter at all rather than a board with nothing on it.

Filters still round-trip through the URL (`q`, `teammate`, `relevance`, `label`), so shared board links keep working.
