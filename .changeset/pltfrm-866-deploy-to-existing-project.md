---
'mastra': patch
---

`mastra studio deploy` and `mastra server deploy` now prompt you to pick from existing projects in the selected organization instead of silently matching by `package.json` name or always creating a new project.

**What changed**

- When existing projects are found, both commands show an interactive selector listing them (plus a "Create new project" option).
- `--project <id-or-slug>` still bypasses the selector for non-interactive use.
- `-y/--yes` auto-accepts only when there is exactly one project whose name or slug matches the local `package.json` name; otherwise it errors asking you to pass `--project`.
- Projects saved in `.mastra-project.json` for the same organization are still auto-matched (no prompt).

This fixes deploys accidentally creating duplicate projects or targeting the wrong existing project when the local package name happened to collide.
