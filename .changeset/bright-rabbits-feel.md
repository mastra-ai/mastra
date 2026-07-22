---
'@mastra/factory': minor
---

Added bounded task-context reads so Factory integrations can show live issue and pull-request details for a session while retaining stored fallback data.

```ts
import type { TaskContext } from '@mastra/factory/capabilities/task-context';

const taskContext: TaskContext = {
  getIssue: async () => ({
    identifier: 'ENG-42',
    title: 'Improve session context',
    description: null,
    state: 'In Progress',
    labels: ['factory'],
    assignees: [],
    url: 'https://linear.app/example/issue/ENG-42',
  }),
};
```
