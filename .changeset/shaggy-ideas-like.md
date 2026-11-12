---
'@mastra/react': minor
---

Fixed the Studio Review Queue showing only results flagged for review from the first 10 results of each experiment. The Review Queue and the Completed view now load every matching result of each experiment, page by page as you scroll.

Added `useInfiniteReviewItems` and `useInfiniteCompletedItems`, which load review items page by page:

```tsx
const { data, hasNextPage, setEndOfListElement } = useInfiniteReviewItems({ experimentId });
```
