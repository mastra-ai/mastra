---
'@mastra/playground-ui': minor
---

Added `LinearIcon` and `SlackIcon` to the design system icon set, so apps can render the Linear and Slack brand marks without hand-rolling their own SVG.

```tsx
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';

<LinearIcon className="text-icon3 size-4" />;
<SlackIcon className="size-4" />;
```

Both take the same props as the other brand icons (`SVGProps<SVGSVGElement>`) and are sized with a class rather than a `size` prop. `GithubIcon` no longer emits a duplicate element id when the same page renders it many times.
