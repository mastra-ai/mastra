---
'@mastra/playground-ui': minor
---

Added the parts for a managed agent's chat page, and a few small additions they need:

- **`ChatLayout`** puts threads in a card on the left and Details in a card on the right, with the chat flat between them. Opening or closing either card slides it while the chat resizes. `{` toggles threads and `]` toggles Details; on phones both open as drawers.
- **`ThreadsCard`** lists threads with their agents' avatars and a lock on private ones. `ThreadsCard.FilterMenu` filters by agent and visibility from inside the search field.
- **`AgentTabs`** and **`AgentEditMenu`** hold the agent's Chat, Traces and Versions tabs and its Edit menu.
- **`DetailsCard`** is the shared Details card, used by `ChatLayout` and `DocumentEditor`, with sections, facts, stats, chips that fold into `+N`, and a hover pencil for editing a section.
- **`ToolRow`** and **`AddToolsDialog`** add and connect tools.
- `SearchInput` takes an `action` for a control at the end of the field, and `ProviderLogo` takes `tinted` for one-color logos that should follow the text color.

```tsx
const [detailsOpen, setDetailsOpen] = useState(true);

<ChatLayout
  threads={<ThreadsCard>…</ThreadsCard>}
  details={<DetailsCard>…</DetailsCard>}
  detailsOpen={detailsOpen}
  onDetailsOpenChange={setDetailsOpen}
>
  {conversation}
</ChatLayout>;
```
