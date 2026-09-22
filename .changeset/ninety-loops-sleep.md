---
'@mastra/playground-ui': minor
---

Gave the `lg` control size its own height.

`lg` controls were 28px, the same height as `md`, and only bumped their text size. They are now 32px, so each step in the scale gains height: 20 / 24 / 28 / 32 for `xs` / `sm` / `md` / `lg`. This affects Button, Input, Textarea, InputGroup, Select, and any control sized from the shared scale.

Icon-only button sizes now come from that same scale instead of a hardcoded 32px. Previously an `icon-lg` button was 32px next to a 28px labelled `lg` button, so a toolbar mixing the two misaligned by 4px.
