---
'@mastra/playground-ui': minor
---

Added `EmptyStateArt`, 23 animated drawings for empty states where people create, set up, or upgrade something. Each drawing loops on hover, keeps looping while setup is running, and shows its own failure when setup fails.

`EmptyState` also gets a `layout="split"` option that puts the drawing beside the text, and a `statusSlot` for a short line under the actions, such as a cost note or live import progress.

```tsx
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { EmptyStateArt } from '@mastra/playground-ui/components/EmptyStateArt';

<EmptyState
  layout="split"
  titleSlot="Give your agents shared knowledge"
  descriptionSlot="A store of pages your agents search, read and write."
  iconSlot={<EmptyStateArt name="knowledge" state={setup.isPending ? 'working' : 'idle'} />}
  actionSlot={<Button variant="primary">Set up knowledge</Button>}
  statusSlot="Creates a dedicated Postgres database."
/>;
```
