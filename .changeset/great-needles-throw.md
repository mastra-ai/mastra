---
'@mastra/playground-ui': minor
---

Added shared message shells, action rows, copy controls, and timestamps. Compose message content and application controls with a consistent bubble, footer, and pending appearance.

The application chooses the copy text and when to show actions. Actions appear on hover or keyboard focus and remain visible on touch devices; use `visibility="always"` for persistent controls.

```tsx
import { Message, MessageActions, MessageCopyButton, MessageTimestamp } from '@mastra/playground-ui/components/Message';

<Message
  from="assistant"
  footer={
    <MessageActions>
      <MessageCopyButton text={reply} />
      <MessageTimestamp value={createdAt} />
    </MessageActions>
  }
>
  {content}
</Message>;
```

Fixed copy controls reporting success when clipboard access fails.
