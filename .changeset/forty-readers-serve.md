---
'@mastra/playground-ui': minor
---

Added `TextLink`, a muted text link with a trailing up-right arrow and an underline that draws in on hover. It inherits the text style of its container, so the same link fits a section header, a caption row, or a card. Pass `href` for a plain anchor or `render` for a router link, swap the arrow with `icon`, or hide it with `icon={false}`.

```tsx
import { TextLink } from '@mastra/playground-ui/components/TextLink';

<TextLink render={<Link to="/usage" />}>View usage</TextLink>;
```
