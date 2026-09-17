---
'@mastra/playground-ui': minor
---

Shared collapsible reasoning between Studio and Factory using inline Markdown styling. Factory now shows streaming and redacted reasoning states; Studio keeps its expand and collapse controls.

The shared renderer accepts reasoning parts from `MessageFactory`:

```tsx
import { ReasoningPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/reasoning-part-renderer';

<ReasoningPartRenderer part={{ type: 'reasoning', reasoning: 'Checking the result…', state: 'streaming' }} />;
```
