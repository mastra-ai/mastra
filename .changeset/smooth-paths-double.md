---
'@mastra/factory': patch
---

Fixed markdown rendering in the Factory chat. Bullet and numbered lists show their markers again instead of collapsing into blankly indented lines, and task lists, tables and blockquotes now render properly. Fenced code blocks go through the design-system code block, so they get syntax highlighting, a copy button and a readable surface, and inline code is legible on every background.

The chat now uses the same markdown renderer as the Studio rather than its own copy, so both stay in sync from here on.
