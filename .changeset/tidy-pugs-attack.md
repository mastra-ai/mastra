---
'@mastra/playground-ui': patch
---

Fixed the `SideDialog` code section header, where the copy button and the multiline toggle rendered at two different heights (28px next to 30px) inside their joined `ButtonsGroup`, so one segment poked out of the pill. `CopyButton` defaults to `sm` while `Button` defaults to `md`, and this header passed neither — both are now `sm`, matching the same header in `DataDetailsPanel` and `DataCodeSection`. The multiline toggle is icon-only and now carries an accessible name.

A `ButtonsGroup` imposes no height of its own: every segment must sit on the same rung of the control size ladder (`sm` 28px, `md` 30px, `lg` 32px), or it will poke out.
