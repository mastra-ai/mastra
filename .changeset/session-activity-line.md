---
'@mastra/playground-ui': minor
---

Added a shared `ActivityLine` to the session transcript so any host can show what a running agent is doing (running tool, thinking, saving memory) from transcript entries and a busy flag. Factory's activity line now renders through it.

```tsx
import { ActivityLine } from '@mastra/playground-ui/domains/chat/transcript';

<ActivityLine entries={transcript.entries} busy={busy} runsStarted={runsStarted} stretchLive={false} />
```
