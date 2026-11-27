---
'@mastra/playground-ui': minor
---

Added Factory's card stage bar, moves graph and panel rows to `@mastra/playground-ui/domains/factory`: `CardStageBar`, `CardStageSummary`, `MovesGraph` with its `movesGraph` layout model, `PanelHeading`, `PanelSubject`, `headerCapsuleClass` and `elapsedLabel`. All take plain props; hosts pass their own phases and, optionally, their own time labels.

```tsx
import { CardStageBar, MovesGraph } from '@mastra/playground-ui/domains/factory';

<CardStageBar current={phase} track={track} stop={stop} next={next} enteredAt={enteredAt} onMove={move} />
<MovesGraph history={card.stageHistory} phases={phases} now={Date.now()} />
```
