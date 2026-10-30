---
'@mastra/playground-ui': minor
---

Added helpers that turn an observability list page's URL into a saved view and apply a saved view back to the URL (`savedViewFromSearchParams`, `applySavedView`). Parts of a view the page no longer supports, such as a removed filter field or column, are dropped one by one and the rest still applies. The spans and threads pages now keep their time range, filters and sort in the URL, so they survive a reload and can be shared.

```ts
import {
  applySavedView,
  savedViewFromSearchParams,
} from '@mastra/playground-ui/domains/observability/saved-view-state';

// Save the current page state as a view.
const view = savedViewFromSearchParams('spans', new URLSearchParams(window.location.search));

// Later, apply it: `params` is the URL to navigate to.
const { params } = applySavedView(view, new URLSearchParams(window.location.search));
```
