---
'@mastra/factory': patch
---

The Factory planning and building skills now state where a plan file must go for both sandbox layouts. `submit_plan` resolves the submitted path against the session workspace root and accepts only a `.md` file directly inside its `.artifacts/plans/`: with one repository in the sandbox the workspace root *is* that checkout, and with several it is the parent directory holding one directory per repository. The old wording said "at the workspace root — never inside a repository checkout" for every case, which in a one-repository sandbox pointed agents at `mastra/.artifacts/plans/issue-5.md` — a path `submit_plan` rejects — instead of the accepted `<checkout>/.artifacts/plans/issue-5.md`.
