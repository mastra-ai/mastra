---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/components/ai/message-reveal`, which paces a whole assistant message — prose, reasoning, tool rows, cards — on one clock, so its parts arrive in the order the model wrote them.

Before, a renderer paced its own text with `useRevealedText`, which could only slow prose down: everything written between two passages landed at once, so a tool row appeared while the sentence before it was still being typed out.

```tsx
import { useRevealedParts } from '@mastra/playground-ui/components/ai/message-reveal';

const parts = useRevealedParts(message.content.parts, streaming);

<MessageFactory message={{ ...message, content: { ...message.content, parts } }} {...renderers} />;
```

The projection happens above the renderers, so none of them has to know a reveal is running.
