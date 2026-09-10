---
'mastra': minor
---

Added per-table markdown copying and CSV downloads to Studio assistant messages. Actions are available once the text containing the table finishes streaming and displaying.

Studio enables these controls automatically. For custom interfaces using `@mastra/playground-ui`, opt in with `tableActions`:

```tsx
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';

<MarkdownRenderer tableActions streaming={streaming}>
  {text}
</MarkdownRenderer>;
```
