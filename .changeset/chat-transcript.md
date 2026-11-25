---
'@mastra/playground-ui': minor
---

Added the chat session transcript (reducer, message and tool rows, `TranscriptEntries`) under `@mastra/playground-ui/domains/chat/transcript`. Host-specific rows plug in through `TranscriptSlotsProvider`:

```tsx
import { TranscriptEntries, TranscriptSlotsProvider } from '@mastra/playground-ui/domains/chat/transcript';

<TranscriptSlotsProvider slots={{ SubmitPlan: PlanCard }}>
  <TranscriptEntries entries={transcript.entries} onApprove={approve} onRespond={respond} />
</TranscriptSlotsProvider>;
```

A host that leaves a slot out gets:

- `RunError`: an error notice with the provider's message.
- `Notification` and `NotificationSummary`: a notice with the message, without links.
- `Approval`: a working approve/decline card.
- `Suspension`: a read-only row naming what the agent is waiting on, marked "Waiting for input", with no way to answer it. A paused call inside a message that asks a question keeps its inline answer form.
- `Subagent`: nothing, because the tool call that started the subagent already names it.
- `SubmitPlan`: the generic tool row, with no way to approve or revise the plan.
- `DataPart`: nothing, so every `data-*` part stays hidden. Pass `{ draws, Component }` to draw your own: a part `draws` accepts renders with `Component`, and the activity line splits around it.
