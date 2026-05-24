---
'@mastra/core': patch
---

**Renamed Harness v1 todo type.** The TypeScript symbols `TaskItem` and `taskItemSchema` on the Harness v1 builtin-tools module are now `HarnessTodo` and `harnessTodoSchema`. The `TaskUpdatedEvent.tasks` field type follows the same rename. The new names free up `Task` for the upcoming canonical work-unit primitive.

**Impact for consumers.** This is a source-level rename only. Tool ids (`task_write`, `task_check`), the persisted thread metadata location, and the `task_updated` event wire shape are all unchanged — no runtime data migration is required. If you imported the renamed symbols directly, update the import:

```ts
// before
import type { TaskItem } from '@mastra/core/harness/v1/builtin-tools';
import { taskItemSchema } from '@mastra/core/harness/v1/builtin-tools';

// after
import type { HarnessTodo } from '@mastra/core/harness/v1/builtin-tools';
import { harnessTodoSchema } from '@mastra/core/harness/v1/builtin-tools';
```

If you only subscribed to `task_updated` events or invoked the `task_write` / `task_check` tools, no change is required.
