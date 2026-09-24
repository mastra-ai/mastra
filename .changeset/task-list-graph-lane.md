---
'@mastra/playground-ui': minor
---

`TaskList` no longer shows a spinner for the task in progress, which read as something loading. The active task now steps out onto its own lane of a small graph drawn beside the list, and its label fades into a warm gradient. A completed task's strike draws in from the left and erases cleanly if the task reopens. Every change between states is animated, and nothing moves when reduced motion is on.

Collapsed, the list is a one-row window on the current task, with the progress bars beside it. Expanding grows that window: the current task slides into place while the tasks around it come into view, and the progress bars fold away. The whole collapsed card expands on click.

When the active task changes, the list scrolls itself smoothly to keep that task visible, instead of also scrolling the page or chat around it.

**Breaking**

- `title` is removed, since the list no longer has a header. Drop the prop.
- `TaskListHeader` is removed. `TaskList` now renders its own toggle.
- `hideWhenEmpty` is removed. An empty `TaskList` always renders nothing. Drop the prop:

  ```diff
  - <TaskList tasks={tasks} hideWhenEmpty={false} />
  + <TaskList tasks={tasks} />
  ```
