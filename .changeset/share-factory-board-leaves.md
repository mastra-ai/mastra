---
'@mastra/playground-ui': minor
---

Added Factory's board leaves to `@mastra/playground-ui/domains/factory`: `RelatedItemLink`, `RelatedCardLink`, `UpstreamLinks`, `BoardLoadingSkeleton`, the list row cells (`ListRowTitle`, `ListRowLinks`, `ListRowLabels`, `ListRowStatus`) and `RELATED_ITEM_LINK_CLASS`. They take plain props, so any app can render Factory's board rows with its own data.

```tsx
import { RelatedItemLink, BoardLoadingSkeleton } from '@mastra/playground-ui/domains/factory';

<RelatedItemLink href="/cards/12" icon={mark} label="#12" ariaLabel="Open #12" tooltip={['Blocks']} LinkComponent={AppLink} />
<BoardLoadingSkeleton layout="list" />
```
