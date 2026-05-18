# Targeted Feature Smoke Pattern

Use this when release scope discovery shows that the generated smoke project does not exercise a changed runtime feature.

When a PR changes a specific feature, smoke the smallest real scenario that proves that feature. Avoid vague substitutes like "agent chat works" for a streaming fix, "tools list loads" for a tool approval fix, or "Studio loads" for a persistence/save bug.

## Pattern

1. Identify the exact changed path from the PR title, files, changelog, and tests.
2. Configure or modify the smoke project so that path is reachable with the released package.
3. Trigger the behavior through the public API or UI a user would use.
4. Assert the before/after condition that would have failed before the fix.
5. Capture concrete evidence: response fields, stream chunks, persisted rows, saved config after reload, trace/span contents, or visible UI text.
6. If the feature requires cloud auth, external credentials, or a separate product like Mastra Code, either run that targeted environment or mark it `PARTIAL`/`NOT COVERED` with the exact reason.

## Targeted additions by category

- **CLI/create-mastra changed:** create a brand-new project at `$SMOKE_DIR/smoke-project` with the release tag and run `pnpm run dev`.
- **Server/adapters/API changed:** add curl checks for `/health`, `/api/agents`, `/generate`, `/stream` if applicable, tool execute, workflow start, custom routes, and invalid routes. If route prefixing changed, add or use a custom route and verify built-in `/api/*` routes remain reserved.
- **Agent streaming changed:** test `/stream`, `resume-stream`, `streamUntilIdle`, abort/length/error behavior, or another endpoint that actually uses the changed streaming path.
- **Tools changed:** test the exact changed tool behavior, such as dynamic tools, approval functions, `requireApproval`, programmatic tool calls, or preserved args. A single static weather tool call is not enough for dynamic/approval/tool-merge changes.
- **Workflows changed:** test the exact changed behavior, such as suspend/resume, background task progress, long-running runs, dataset/experiment workflows, or `start-async` output shape.
- **Memory changed:** test thread/resource isolation plus the changed memory mode, such as current-thread recall defaults, observational memory boundaries, or agent network incompatibility. A basic two-call memory check is necessary but may not be sufficient. If the change only affects memory under a specific storage backend, configure the smoke project to use that backend.
- **Memory storage migrations changed:** run an end-to-end migration smoke against the affected backend. Use `references/storage-provider-migration-smoke.md`.
- **Forked subagents changed:** create or use a Mastra Code/subagent scenario that proves parent thread/resource inheritance and prompt cache prefix behavior. Do not assume a normal agent run covers forked subagents.
- **Studio/Playground changed:** run browser smoke for the affected pages, especially observability traces/logs/metrics and theme/layout changes.
- **Auth/permissions/Agent Builder changed:** prefer staging/production cloud smoke with an authenticated user and targeted permission flows. Local create-mastra usually does not cover stored agents/skills, starring, visibility, avatar upload, or server-side session refresh.
- **MCP/A2A changed:** default empty MCP state is only a baseline. For SDK/client/server or schema-validator changes, run a targeted MCP/A2A integration check with a configured server/client when feasible.
- **Storage/provider packages changed:** at minimum verify package installation/import. If the changed provider can run locally in Docker, run a provider-backed smoke against the released package rather than stopping at import.
- **Mastra Code changed:** run a separate Mastra Code/TUI smoke path; do not assume standard create-mastra smoke covers it.
- **Docs/examples changed:** run docs validation or example-specific checks; do not replace runtime smoke with docs-only checks.

## Examples

- For streaming fixes: call `/stream` or `resume-stream`, inspect event chunks and final response shape.
- For tool approval/dynamic tool fixes: configure the affected tool mode, run an agent that triggers it, and verify approval/rejection or dynamic resolution behavior.
- For workflow fixes: run the specific workflow mode changed, such as suspend/resume, background progress, or long-running output shape.
- For Studio persistence fixes: change the affected form field, save, reload/refetch, and verify the value persisted.
- For observability fixes: generate the affected run type and verify trace/span/scores/logs include the corrected data.
- For CLI/create fixes: create a fresh project with the published CLI and verify generated files/dependencies/scripts match the intended output.
