---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Redesign Agent Chat layout to make common actions easier to find and keep the chat focused.

- Move runtime controls (Model Settings, Tracing Options, and Request Context) into a composer-adjacent **Chat Settings** dialog.
- Replace the left sidebar text tabs with icon tabs for Conversations and Memory, with Memory content shown directly in the sidebar.
- Simplify the right panel to agent details and collapse it behind an icon-only **Agent Details** affordance.
- Add a centered empty-state composer that slides to the bottom after the first message.
- Move agent utility actions (copy/edit/clone/share) into icon-only controls on the top tab bar.
- Add per-thread clone actions next to delete in the left thread list.
- Update Agent Chat E2E coverage to validate the relocated controls and access paths.
