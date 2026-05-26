---
'@mastra/playground-ui': patch
---

Removed the EntityList and EntityListPageLayout components — they were superseded by DataList. The 9 Studio root list pages (Agents, Datasets, Experiments, MCPs, Processors, Prompts, Scorers, Tools, Workflows) now build on DataList, matching the condensed layout shared across the rest of Studio.

**Migration**

If you were importing EntityList or EntityListPageLayout from `@mastra/playground-ui`, switch to DataList — its API is a strict superset:

```tsx
// Before
import { EntityList, EntityListSkeleton } from '@mastra/playground-ui';

// After
import { DataList, DataListSkeleton } from '@mastra/playground-ui';
```

The primitive names match (`.Top`, `.TopCell`, `.TopCellSmart`, `.RowLink`, `.Cell`, `.TextCell`, `.NameCell`, `.DescriptionCell`, `.NoMatch`, `.Pagination`). DataList additionally exposes `.Row`, `.RowButton`, `.RowStatic`, `.IdCell`, `.MonoCell`, `.SelectCell`, `.NextPageLoading`, and more — useful when you need selection rows or action cells outside a RowLink.
