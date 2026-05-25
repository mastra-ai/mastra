# Release Scope Discovery

Before running release smoke tests, determine what changed since the last release. Do not rely only on the default smoke-test checklist; use the release diff to decide whether targeted checks are needed.

## 0. Create a dated smoke-test workspace

Create a date-scoped workspace before collecting release artifacts. Keep the generated Mastra project, PR list, logs, and smoke reports together.

```bash
SMOKE_DATE=$(date +%F)
SMOKE_DIR="$HOME/mastra-smoke-tests/$SMOKE_DATE"
mkdir -p "$SMOKE_DIR/logs"
```

If `$HOME/mastra-smoke-tests` is outside the repo sandbox, request filesystem access before writing there.

Expected layout:

```text
~/mastra-smoke-tests/YYYY-MM-DD/
  merged-prs.tsv
  smoke-scope.md
  smoke-report.md
  logs/
  smoke-project/
  stable-smoke-project/
```

Prefer the helper script when available:

```bash
.claude/skills/mastra-smoke-test/scripts/discover-release-scope.sh --release-tag '@mastra/core@1.28.0'
```

The script writes `merged-prs.tsv` and a starter `smoke-scope.md` to the workspace.

## 1. Identify the last release baseline

Find the previous stable release tag and timestamp. Prefer the tag/release that corresponds to the package being released, usually `@mastra/core@<version>` for monorepo releases.

```bash
gh release list --limit 20
gh release view '@mastra/core@<version>' --json tagName,publishedAt,createdAt,targetCommitish,url
git show -s --format='%H %cI %s' '@mastra/core@<version>'
```

Use the tag commit date or release `createdAt` as the cutoff for merged PR discovery. State which cutoff you used.

## 2. List merged PRs since the cutoff

Export merged PRs since the baseline into the dated workspace. Exclude Dependabot unless the release specifically needs dependency smoke coverage.

```bash
gh pr list \
  --state merged \
  --search 'merged:>=YYYY-MM-DDTHH:MM:SSZ -author:app/dependabot' \
  --limit 200 \
  --json number,title,author,mergedAt,labels,url \
  --jq '.[] | [.number, .mergedAt, .author.login, .title, .url] | @tsv' \
  > "$SMOKE_DIR/merged-prs.tsv"
```

If the release has more than 200 PRs, paginate or narrow by date ranges until the full set is captured. Cross-check with first-parent merge commits when needed:

```bash
git log --first-parent --oneline '@mastra/core@<previous>'..origin/main
```

## 3. Categorize the PRs

Group PRs by runtime surface area and smoke implication:

| Category                           | Match criteria                                                             | Smoke implication                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Core agent loop/streaming          | `packages/core/src/agent`, stream/resume, message conversion, loop control | Agent generate + stream/resume + memory/thread checks                  |
| Tools/processors                   | tool execution, dynamic tools, approval, processors                        | Tool list/execute + agent tool-call path + changed processor behavior  |
| Workflows                          | `workflows`, suspend/resume, start-async, workflow output                  | Workflow API + Studio workflow run + traces                            |
| Memory/observability               | memory, threads, traces, scorers, logs, metrics                            | Memory persistence + trace/span/scores verification                    |
| Server/adapters/API                | server, route registration, Express/Fastify/Hono/Koa adapters              | `/health`, `/api/*`, custom route, invalid route checks                |
| CLI/create-mastra                  | `create-mastra`, templates, generated deps                                 | Fresh project install from target tag/version                          |
| Studio/Playground UI               | `packages/playground-ui`, `packages/playground`                            | Browser smoke for affected pages                                       |
| Agent Builder/auth/stored entities | stored agents/skills, auth, visibility, starring, avatar, permissions      | Authenticated staging/cloud checks when local cannot cover             |
| MCP/A2A                            | MCP server/client/schema, A2A protocol                                     | MCP endpoints plus configured server/client if changed                 |
| Storage/providers                  | Postgres, LibSQL, Redis, S3, Azure, vector stores                          | Provider install/import and targeted backend smoke when feasible       |
| Mastra Code/TUI                    | `mastracode`, subagents, slash commands                                    | Separate Mastra Code smoke; default create-mastra does not cover it    |
| Docs/examples only                 | docs, examples                                                             | Docs/example validation; no runtime smoke unless example is executable |

## 4. Convert categories into a smoke plan

Use full smoke as the baseline, but do **not** stop at the default generated-project happy path. The goal is to prove the **actual changed feature or bug fix** works in the published package, not just that a nearby happy path still works.

For every material PR, ask:

1. What user-visible behavior, API behavior, persistence behavior, or integration path changed?
2. Does the generated smoke project execute that exact path?
3. If not, what is the smallest targeted check that proves the changed behavior?
4. What evidence will show the fix worked, not merely that the app did not crash?

If the default project does not exercise the changed feature, add a targeted check or explicitly record why it cannot be tested in this environment.

For targeted check patterns, read `references/targeted-feature-smoke.md`. For storage/provider schema or migration changes, read `references/storage-provider-migration-smoke.md`.

Add a **Coverage vs Changes** table to `$SMOKE_DIR/smoke-scope.md` before testing:

| Feature / PRs                        | Generated project covers it? | Targeted check to run                                                                                                                                          | Result / reason omitted     |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Example: `resume-stream`             | No                           | Call resume-stream after starting a stream and verify resumed chunks/final response                                                                            | PASS/FAIL or blocked reason |
| Example: tool approval change        | No                           | Configure a tool with `requireApproval`, trigger it from an agent, approve/reject, verify the changed approval behavior                                        | PASS/FAIL or blocked reason |
| Example: Playground save persistence | No                           | Edit the affected Studio/Agent Builder form, save, reload/refetch, verify the changed field persists                                                           | PASS/FAIL or blocked reason |
| Example: PG OM migration column      | No                           | Run Postgres in Docker, configure smoke project with `@mastra/pg`, drop old/missing column, restart, verify migration restores it and memory/OM writes succeed | PASS/FAIL or blocked reason |
| Example: default weather tool        | Yes                          | Agent/tool smoke                                                                                                                                               | PASS                        |

Write the scope analysis to `$SMOKE_DIR/smoke-scope.md` before running tests so it is not trapped in terminal output. Include:

- release baseline tag and cutoff timestamp
- command used to collect PRs
- categorized PR table with PR number, title, author, merged time, and category
- targeted smoke plan derived from the categories
- coverage-vs-changes table showing what the generated project covers naturally and what needs targeted checks
- any omitted PRs/commits and why, including Dependabot, direct non-PR commits, cloud-only features, missing credentials, or product areas outside create-mastra

Report the category summary and the coverage-vs-changes summary before running tests so the user can see why each targeted check is included and where the default smoke project is insufficient.
