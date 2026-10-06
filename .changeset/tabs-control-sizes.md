---
'@mastra/playground-ui': patch
---

Tabs now share the control sizes of buttons and inputs, so a `TabList` lines up with a `Button` or `Input` of the same size in one row. A `pill` track is as tall as the control (`sm` 28px, `md` 30px), with the tabs inside it; before, the default `md` pill track was taller than an `md` button. `pill-ghost` tabs already matched.

Added a Foundations/Control sizes story that shows every control at each size side by side.
