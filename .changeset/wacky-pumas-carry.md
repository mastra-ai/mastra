---
'@mastra/playground-ui': minor
---

Added an `info` prop to `FieldLabel`. It shows a small info icon after the label with your text in a tooltip on hover or keyboard focus. Screen readers announce the text as the icon's description, and clicking the icon never focuses the field.

```tsx
<FieldLabel info="Shown to people who pick this agent.">Display name</FieldLabel>
```

Added `InfoTooltip`, the same info icon for use outside form labels, such as next to a heading or a toolbar control:

```tsx
import { InfoTooltip } from '@mastra/playground-ui/components/Tooltip';

<InfoTooltip aria-label="Version information" side="bottom" align="start">
  Each save creates a version you can switch back to.
</InfoTooltip>;
```

`TooltipContent` takes `keepMounted` to keep a closed tooltip in the page (hidden), for example so its trigger can point `aria-describedby` at it.

Removed `RequestContextLabel` (`@mastra/playground-ui/domains/request-context/components/request-context-label`). Use `FieldLabel` with `info` instead:

```tsx
<FieldLabel info="Values passed to the agent at runtime.">Request context</FieldLabel>
```
