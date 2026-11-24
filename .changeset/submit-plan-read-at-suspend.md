---
'@mastra/code-sdk': patch
---

`submit_plan` now reads the plan file when the run suspends, so approval cards always render the plan. The tool ships as a filesystem-free builtin that only knows the plan file path and expects the host to fill in the plan, and nothing did, so the card fell back to re-reading the file later through the session workspace. That broke whenever the sandbox was recreated, the plans directory moved, or the file was edited after submission — the card showed "The plan could not be loaded from <path>" with Approve disabled, and a later read could show a different plan than the one reviewed.

Submitting a path outside the plans directory now fails immediately with the location to write instead of parking an unrenderable card. The submitted path must resolve to a markdown file directly inside the session's plans directory, relative to the session workspace root:

- **Mastra Code sessions, including the TUI:** the plans directory is `.mastracode/plans`, or `plansDir` when one is configured. Submit `.mastracode/plans/add-dark-mode.md`.
- **Factory sessions:** the plans directory is `.artifacts/plans`. With one repository in the sandbox the workspace root is that checkout; with several it holds one directory per repository. In both layouts submit `.artifacts/plans/issue-5.md` at the root, not a repository-prefixed `mastra/.artifacts/plans/issue-5.md`.

The builtin used to accept any path it was given and leave the card to re-read it later. Now the path is checked before suspending, and the error names the directory to write in. In a Factory session:

```ts
// before: any path parked, and the card re-read it afterwards
submit_plan({ path: 'mastra/.artifacts/plans/issue-5.md' });

// after: the path must resolve directly inside the plans directory
submit_plan({ path: '.artifacts/plans/issue-5.md' });
```

`approvePlanFile` now accepts the reviewed plan text and archives that, instead of re-reading the file, so the archived plan is the one the user approved.
