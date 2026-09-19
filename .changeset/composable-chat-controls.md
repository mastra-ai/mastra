---
'@mastra/playground-ui': minor
---

Added Send, Stop, attachment and model-settings buttons that can be composed inside `ComposerActions`. Send, Stop and attachment buttons support round and outline appearances, with disabled states and callbacks supplied by the caller.

```tsx
import { ComposerActions, ComposerSendButton, ComposerStopButton } from '@mastra/playground-ui/components/Composer';

<ComposerActions>
  <ComposerSendButton aria-label="Send message" disabled={sendDisabled} />
  {onStop && <ComposerStopButton aria-label="Stop response" onClick={onStop} />}
</ComposerActions>
```
