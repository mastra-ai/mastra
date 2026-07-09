---
'@mastra/core': minor
---

Added the plan title and body to the `submit_plan` suspension so hosts render the submitted plan without re-reading the plan file.

`submit_plan` now reads the markdown file it was given and inlines the parsed title and body into the suspension it emits (the same way `ask_user` inlines its question). Studio and other hosts receive the plan on the live stream, in stored history, and on replay with no extra work. When the file cannot be read, the suspension still carries just the path.

**Before** — the suspension carried only the path, so hosts had to locate and read the plan file themselves:

```ts
// tool-call-suspended payload
{ path: '.mastracode/plans/add-dark-mode.md' }
```

**After** — the suspension carries the plan:

```ts
// tool-call-suspended payload
{ path: '.mastracode/plans/add-dark-mode.md', title: 'Add dark mode', plan: '## Steps\n...' }
```
