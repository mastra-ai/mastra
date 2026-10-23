# Fix documentation prose lint

Run `pnpm lint:prose` from the `docs` directory and fix all reported errors. Preserve the intended meaning, technical accuracy, and correct grammar. The outcome should be natural, readable documentation—not merely text that passes lint.

- Follow `docs/AGENTS.md` and the `mastra-docs` skill. Read each flagged passage in context before editing.
- Make focused wording changes. Preserve API names, code examples, links, and technical distinctions. Check source when a rewrite could change a technical claim.
- Don't mechanically split sentences or replace words if that makes the prose awkward, obscures cause and effect, or introduces another lint violation.
- Don't disable rules, add suppressions, or change lint configuration to make errors disappear.
- Preserve unrelated working-tree changes. Don't commit or push unless asked.

Rerun `pnpm lint:prose` until it passes. Run `pnpm format:mdx:check` from `docs` and `git diff --check`, then review the diff for accidental meaning changes. If a check is blocked, report the blocker rather than claiming success.

Summarize what changed and which checks passed. Leave the edits ready for review.
