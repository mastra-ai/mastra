---
'@mastra/playground-ui': minor
---

Added `Pagination` at `@mastra/playground-ui/components/Pagination`: page navigation built from parts (`Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`), plus `getPaginationRange` for choosing which page numbers to show. The current page slides between pages, and links can render as anchors or router links.

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@mastra/playground-ui/components/Pagination';

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationLink isActive>1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink onClick={() => setPage(1)}>2</PaginationLink>
    </PaginationItem>
  </PaginationContent>
</Pagination>;
```
