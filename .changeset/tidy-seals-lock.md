---
'@internal/playground': patch
---

Studio now respects the `editor` config on code-defined agents when locking editable fields.

Previously, an agent declared with `editor: { instructions: false }` still rendered an editable instructions block in the agent editor, so users could type changes the server would then reject on save. Only the `editor: false` shape locked anything, and it locked everything.

Two behaviors are fixed:

- `editor: { instructions: false }` renders the instructions as read-only content, matching how `editor: { tools: false }` already locked the tools surface.
- An `editor` object that locks every editable field (for example `{ instructions: false, tools: false }`) is now treated the same as `editor: false`: the editor shows the "Read-only" badge and the Save and Publish buttons are disabled.

Ownership is derived in one place and mirrors the server's rules — a field is editable only when it is explicitly `true` or when no `editor` config is set at all. Agents that are not code-defined are unaffected and stay fully editable.
