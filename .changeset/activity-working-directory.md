---
'@mastra/playground-ui': minor
---

Activity details now read in the body font at the label's size, so a row reads as one phrase. `ActivityDetail` no longer takes `font`, and `ActivityHeadline` and `ActivityItem` no longer take `detailFont`. Drop the prop:

```tsx
// Before
<ActivityDetail font="mono">{path}</ActivityDetail>
<ActivityItem {...item} detailFont="mono" />

// After
<ActivityDetail>{path}</ActivityDetail>
<ActivityItem {...item} />
```

Wrap a transcript in `ActivityWorkingDirectory` to show paths under the agent's working directory relative to it, both on screen and in the row's accessible name:

```tsx
import { ActivityWorkingDirectory } from '@mastra/playground-ui/components/ai/activity';

<ActivityWorkingDirectory path="/sandboxes/7b45/mastra">{transcript}</ActivityWorkingDirectory>;
// "/sandboxes/7b45/mastra/packages/core/package.json" reads "packages/core/package.json"
```

Use `useRelativePaths()` to rewrite your own text the same way.
