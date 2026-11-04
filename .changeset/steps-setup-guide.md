---
'@mastra/playground-ui': minor
---

Added `Steps`, a numbered vertical rail for setup guides, like the steps in docs. Each `Steps.Step` takes a title, an optional description and action, and a `done` flag that swaps its number for a check. Steps number themselves in render order, so they can be rendered conditionally or composed from several components.

```tsx
import { Steps } from '@mastra/playground-ui/components/Steps';

<Steps>
  <Steps.Step title="Create an API key" done>…</Steps.Step>
  <Steps.Step title="Send your first request" />
</Steps>
```

`PageHeader.Description` now wraps with `text-pretty`, so a long description no longer leaves a single word on its last line.
