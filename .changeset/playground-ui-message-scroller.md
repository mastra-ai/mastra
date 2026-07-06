---
'@mastra/playground-ui': patch
---

Added reusable message scroller and thread rail primitives for conversation navigation, plus a shared `useIsomorphicLayoutEffect` hook for layout work that must also render safely on the server.

```tsx
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@mastra/playground-ui/components/MessageScroller';
import { ThreadRail, buildThreadRailTurns } from '@mastra/playground-ui/components/ThreadRail';

const turns = buildThreadRailTurns(messages);

<MessageScrollerProvider>
  <MessageScroller>
    <MessageScrollerViewport>
      <MessageScrollerContent>
        {messages.map(message => (
          <MessageScrollerItem key={message.id} messageId={message.id}>
            <MessageRow message={message} />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton />
    <ThreadRail turns={turns} />
  </MessageScroller>
</MessageScrollerProvider>;
```
