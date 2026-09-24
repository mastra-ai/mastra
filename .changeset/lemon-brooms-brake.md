---
'@mastra/playground-ui': minor
---

Added `InlineCode` for code inside a sentence, and documented when to use monospace text.

Code is always marked as code: `InlineCode` in running text, and a highlighted `CodeBlock` for anything longer. `Txt font="mono"` is for machine identifiers such as model IDs, hashes, and log lines, and for timestamps and durations. Other numbers, such as counts and costs, stay in the body face with `tabular-nums`. It keeps the role's size, line height, and weight and changes only the typeface. `DataList.NumberCell` takes `font="mono"` for duration columns, and trace and workflow durations now render in mono. KPI values and chart axes stay in the body face.

```tsx
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';

<Txt variant="body-sm" tone="muted">
  Set <InlineCode>OPENAI_API_KEY</InlineCode> to use this model.
</Txt>

<Txt variant="caption" font="mono" tone="muted">
  run_01JQX8K2M4
</Txt>
```

`Txt` now accepts `font="body"`, the default, alongside `font="mono"`. Set `--font-mono` in your own CSS to use a different monospace typeface. Set `--font-mono-size-adjust` to the body face's x-height ratio, such as `ex-height 0.508`, so mono text looks the same size as the text around it.
