---
'@mastra/playground-ui': minor
---

Added `size` variants to `Kbd` so keyboard hints can sit inside compact controls without hand-written overrides. Sizes are `default` (24px), `sm` (20px) and `xs` (16px), each with a fixed height so the scale stays even across fonts.

    <Kbd size="sm">Esc</Kbd>
    <Kbd size="xs">⌘ K</Kbd>
