---
'@mastra/playground-ui': minor
---

Added Factory board layout components (stages, columns, list, drag and drop, virtual scrolling, skeletons, inline card composer) under `@mastra/playground-ui/domains/factory` so hosts other than Factory can render a board.

```tsx
import { BoardStages, stageTone } from '@mastra/playground-ui/domains/factory';
import { Badge } from '@mastra/playground-ui/components/Badge';

<BoardStages
  layout="board"
  stages={stages.map(stage => ({
    stage: { id: stage.id, label: stage.name },
    taskCount: stage.cards.length,
    loading: false,
    collapsed: false,
    groupOpen: true,
    onGroupOpenChange: open => toggleStage(stage.id, open),
    cards: stage.cards.map(card => <MyCard key={card.id} card={card} />),
  }))}
  totalTaskCount={totalCards}
  onDrop={(payload, toStage) => moveCard(payload.id, toStage)}
  toolbar={<MyToolbar />}
/>

<Badge variant={stageTone(stage.id)}>{stage.name}</Badge>
```

`stageTone(stage)` gives a phase's badge colour, matching its column tint, so a host's stage badges and board columns agree.
