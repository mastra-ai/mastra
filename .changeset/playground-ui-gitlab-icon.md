---
'@mastra/playground-ui': patch
---

Added a `GitLabIcon` export, so a GitLab-sourced item can carry its own mark instead of borrowing another provider's.

```tsx
import { GitLabIcon } from '@mastra/playground-ui/icons/GitLabIcon';

<GitLabIcon className="size-4 text-accent6" />;
```
