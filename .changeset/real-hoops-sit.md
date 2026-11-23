---
'@mastra/playground-ui': minor
---

Added `MarkdownEditor`, a markdown field that reads like the rendered page. Headings, bold, links, lists and quotes show formatted, and their markdown appears only on the line or span the caret is in. The value you get back is exactly the markdown that was typed, never rewritten.

- Select text to bold, italicize, format as code or link it, from a floating toolbar or with ⌘B, ⌘I, ⌘E and ⌘K (Ctrl on Windows and Linux).
- Type `/` at the start of a line to turn it into a heading, list, quote, code block or divider.
- Paste a URL over selected text to link it.

```tsx
import { MarkdownEditor } from '@mastra/playground-ui/components/MarkdownEditor';

<MarkdownEditor aria-label="Instructions" value={instructions} onChange={setInstructions} variant="inline" />;
```
