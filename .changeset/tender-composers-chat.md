---
'@mastra/playground-ui': minor
---

Added a compound Composer for building controlled AI message inputs with attachments and action controls.

```tsx
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerSubmitButton,
} from '@mastra/playground-ui/components/ai/composer';

<Composer onSubmit={handleSubmit}>
  <ComposerBox>
    <ComposerInput value={message} onChange={handleChange} />
    <ComposerActions>
      <ComposerSubmitButton aria-label="Send message" />
    </ComposerActions>
  </ComposerBox>
</Composer>;
```
