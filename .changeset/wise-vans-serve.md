---
'@mastra/playground-ui': minor
---

Redesigned `Notice` so it reads as part of the page instead of a colored box. The card is now neutral, and its tone shows as a grain gradient glow along the left edge. The icon moves to the bottom right, the title is sentence case, and `Notice.Button` is now an underlined text action on its own row under the message. When there is no action, the icon sits on the last line of text, so a notice without one stays compact. The `Notice` API is unchanged.

Added `GrainFill`, the grain gradient behind `Notice`, so other surfaces can use the same fill. Set `tone` to a status (`warning`, `destructive`, `info` or `success`) for the same tuned ramps `Notice` uses, or to any color token, such as `brand-purple` or `chart-pink`, to build the ramp from that color. Give it the size to render at. The ramp adapts to light and dark mode, and each fill renders once per tone, theme and size, then is reused.

```tsx
import { GrainFill } from '@mastra/playground-ui/components/GrainFill';

<GrainFill tone="warning" width={1200} height={240} className="absolute inset-0 -z-10" />;
<GrainFill tone="brand-purple" width={1200} height={240} className="absolute inset-0 -z-10" />;
```
