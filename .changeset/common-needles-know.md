---
'@internal/playground': minor
---

Improved the Studio workflows list with composition and live run status:

- Workflows that compose other workflows now show a nested count and expand into a tree with connector lines. Registered children link to their own pages and expand recursively; nested workflows that are not registered standalone appear as inline, non-link rows.
- A new **Running** column shows how many runs of each workflow are currently in flight (several can run in parallel).
- A new **Pending input** column shows how many runs are suspended waiting to be resumed — the human-in-the-loop state — so runs needing attention are visible at a glance. Both counts refresh automatically from a single aggregated request per refresh; transient errors keep polling so a network blip never silences the counts. Against older servers that predate the run-counts endpoint, the count columns stay blank and polling stops after the first not-found response.
- The list now fits the viewport width instead of scrolling horizontally; long descriptions truncate.
