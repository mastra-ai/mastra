---
'@mastra/playground-ui': patch
---

Added reusable message scroller and thread rail primitives for conversation navigation.

```tsx
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  ThreadRail,
  buildThreadRailTurns,
} from '@mastra/playground-ui/components/MessageScroller';

const turns = buildThreadRailTurns(messages);

<MessageScrollerProvider>
  <MessageScroller>
    <MessageScrollerViewport>
      <MessageScrollerContent>
        {messages.map(message => (
          <MessageScrollerItem key={message.id} messageId={message.id}>
            {() => <MessageRow message={message} />}
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <ThreadRail turns={turns} />
  </MessageScroller>
</MessageScrollerProvider>;
```
