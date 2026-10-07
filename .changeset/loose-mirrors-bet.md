---
'@mastra/playground-ui': minor
---

Added custom answers alongside suggested ask_user options in Factory and Studio. Single-select answers remain strings; multi-select answers include selected options and custom text in a string array.

Added composable `AskUser.Root`, `Question`, `Options`, `Option`, `CustomAnswer`, `TextAnswer`, and `Submit` components. They share answer state and accessibility through the root. The existing payload-based `AskUser` card remains available and uses the same components.

```tsx
import { AskUser } from '@mastra/playground-ui/components/ai/ask-user';

<AskUser payload={questionPayload} onSubmit={handleAnswerSubmit} />
```

Compose the controls to customize the layout:

```tsx
import * as AskUser from '@mastra/playground-ui/components/ai/ask-user';

<AskUser.Root selectionMode="single_select" onSubmit={handleAnswerSubmit}>
  <AskUser.Body>
    <AskUser.Question>Choose a deployment target</AskUser.Question>
    <AskUser.Options>
      <AskUser.Option value="Staging">Staging</AskUser.Option>
      <AskUser.CustomAnswer />
    </AskUser.Options>
    <AskUser.Submit when="custom-answer" />
  </AskUser.Body>
</AskUser.Root>
```
