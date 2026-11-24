---
'@mastra/factory': patch
---

Added `workItemBoardSource`, which returns the source a board shows a card under and filters it by. The board's source filter and Factory UI both read it, so a card can no longer show one source and be filtered as another.

```ts
import { workItemBoardSource } from '@mastra/factory/work-item-branch';

workItemBoardSource({ integrationId: 'vanta', type: 'vulnerability', externalId: 'vuln-1' });
// 'vanta-vulnerability'
```
