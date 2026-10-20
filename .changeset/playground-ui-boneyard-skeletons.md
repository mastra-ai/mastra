---
'@mastra/playground-ui': minor
---

Loading skeletons for the agents list and traces page now match the real layout. They are captured from the rendered UI with [boneyard](https://github.com/0xGF/boneyard) and use the theme colours in light and dark mode. Animation stops when reduced motion is on.

Added `BoneSkeleton` and `BoneSuspense` (`@mastra/playground-ui/components/Bones`). Each one shows the committed skeleton for its `name` while loading. `BoneSkeleton` also takes an optional `label` that screen readers announce while loading.

Removed `TracesPageSkeleton` (`@mastra/playground-ui/domains/traces/components/traces-page-skeleton`). Use the `traces-page` bone instead:

```tsx
// Before
import { TracesPageSkeleton } from '@mastra/playground-ui/domains/traces/components/traces-page-skeleton';

<TracesPageSkeleton columnPreferences={preferences} />;

// After
import { BoneSkeleton } from '@mastra/playground-ui/components/Bones';

<BoneSkeleton name="traces-page" label="Loading traces" loading />;
```
