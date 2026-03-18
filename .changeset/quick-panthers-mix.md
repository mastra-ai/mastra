---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Redesign Agent Chat layout to simplify the right sidebar and move operational controls into contextual surfaces.

- Move runtime controls (Model Settings, Tracing Options, and Request Context) into a new composer-adjacent **Chat Settings** dialog.
- Simplify the right panel to agent metadata and default it to collapsed with an **Agent Overview** affordance.
- Move thread-level actions by adding per-thread clone actions next to delete in the left thread list.
- Move memory controls into the left sidebar via a dedicated **Memory** modal entry point.
- Move agent utility actions (copy/edit/clone/share) into icon-only controls on the top tab bar.
- Update Agent Chat E2E coverage to validate the relocated controls and access paths.
