---
'@mastra/core': minor
---

Added a built-in Continue button for channel error cards. Return a card with a `CONTINUE_RUN_ACTION_ID` button from `formatError`. A click sends `Continue.` to the agent from the person who clicked, through `onSubscribedMessage`, the same way a reply in the thread would.

```ts
import { CONTINUE_RUN_ACTION_ID } from '@mastra/core/channels';
import { Actions, Button, Card, CardText } from 'chat';

const channels = {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      formatError: error =>
        Card({
          title: 'Run stopped',
          children: [
            CardText(error.message),
            Actions([Button({ id: CONTINUE_RUN_ACTION_ID, label: 'Continue' })]),
          ],
        }),
    },
  },
};
```
