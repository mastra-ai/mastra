# PR #16943: feat(mastracode): run on Harness v1 runtime

Source: https://github.com/mastra-ai/mastra/pull/16943

Order: 23 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-complete-core` -> `feat/mastracode-harness-v1-runtime`

Diff size: +7861 / -348; 79 changed files.

## Before

Mastra Code had an adapter branch but was not fully promoted onto the native v1 runtime.

## What changed

Ran Mastra Code on the Harness v1 runtime, adopting v1 subagent spawning, runtime controls, modified-file tracking, OM progress bridging, and event bridge hardening.

## Why this is suspicious

- This is the highest-risk product migration PR. It changed runtime ownership across TUI, headless, tools, subagents, OM, and event rendering.
- Native v1 subagents can conflict with legacy/v0 subagents; later PRs explicitly kept v0 subagents out of v1.
- Runtime controls and event bridge changes can break abort, approvals, and progress UI.

## Feature surfaces to retest

- Complete smoke test: TUI chat, tool call, edit, shell, approval, abort.
- Subagent invocation and model selection.
- OM observation/reflection progress.
- Modified files/diff command.
- Headless formats.

## Commit headlines

- `e9b0448692` feat(mastracode): run on harness v1 runtime
- `553f9fcdf0` fix(mastracode): harden harness v1 runtime parity
- `1905c346d3` fix(harness): complete provider callback parity follow-ups
- `cc93818cbb` Adopt native Harness v1 subagent spawning in MastraCode
- `79fd21aa4a` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `fcf86bec91` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `7829476701` fix(mastracode): resolve subagent model from harness context
- `6d2c1bb314` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `69dd30ebb0` fix(mastracode): retain om progress from harness v1
- `7c2dc564c6` fix(mastracode): sync v1 runtime controls
- `bfa42a6768` fix(mastracode): track v1 modified files
- `caedc1a5ee` fix(mastracode): adopt forked v1 subagents
- `6344e771f6` fix(harness): resolve v1 tool permissions per call
- `321d263744` fix(harness): preserve late om stream events
- `66979f21c5` feat(harness): expose live signal route
- `bed27f6314` fix(harness): validate custom event emission
- `872f94c659` Merge remote-tracking branch 'origin/main' into pr-16943
- `c8229d4086` docs(harness): document storage capability boundaries
- `ea7963dfb2` docs(mastracode): document native subagent runtime
- `57910575b7` fix(harness): replay events for closed sessions
- `7bd1599428` fix(harness): bridge om activation events
- `96b5e53674` chore(harness): update generated route metadata
- `317c0369b1` fix(mastracode): polish headless thread setup
- `8d3c34fdf0` feat(harness): filter workspace action journal entries
- `94280850cc` fix(mastracode): complete harness v1 runtime adoption
- `128d054c8a` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `f24632c21d` fix(mastracode): harden harness event bridge
- `16ea0e1b27` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `e6824448be` fix(mastracode): honor harness subagent model context
- `413848b7d2` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `f03c2e93fc` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `1778951b68` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `4ca8bee9d5` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `51323b7efb` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `38ec49df9e` fix(harness): tighten replay and workspace action taxonomy
- `53df8aff6a` fix(server): keep harness event parser peer compatible
- `fd5a1d9fd8` fix(mastracode): tighten native harness v1 adapter
- `04822e3647` fix(mastracode): complete native harness runtime adoption
- `71a1c55ba5` Merge remote-tracking branch 'origin/main' into pr-16943
- `2bbd089d0c` fix(mastracode): preserve sandbox access suspensions
- `8567eba37e` fix(mastracode): refresh harness v1 runtime branch
- `318abc7830` feat(core): add harness queue scheduling options
- `704a385021` feat(core): add harness queue backpressure
- `a6e8ec5ac4` add dummy request context
- `ace45ed84a` fix(mastracode): tighten harness v1 compatibility
- `e4c999d03b` fix: stabilize MastraCode Harness v1 startup and resumes (#17042)
- `0f78a89815` Merge branch 'feat/harness-v1-complete-core' into feat/mastracode-har…

## Changed files

- `.changeset/blue-results-pull.md` (+19 / -0)
- `.changeset/cute-mails-brush.md` (+24 / -0)
- `.changeset/full-monkeys-teach.md` (+5 / -0)
- `.changeset/harness-v1-mastracode-runtime.md` (+7 / -0)
- `.changeset/mastracode-subagent-model-precedence.md` (+5 / -0)
- `.changeset/sweet-sites-show.md` (+5 / -0)
- `.changeset/tired-regions-act.md` (+5 / -0)
- `client-sdks/client-js/src/route-types.generated.ts` (+3 / -0)
- `docs/src/mastra-code/customization.mdx` (+11 / -1)
- `docs/src/mastra-code/modes.mdx` (+3 / -1)
- `docs/src/mastra-code/reference.mdx` (+4 / -0)
- `docs/src/mastra-code/tools.mdx` (+1 / -1)
- `mastracode/README.md` (+19 / -0)
- `mastracode/src/__tests__/index.test.ts` (+61 / -16)
- `mastracode/src/__tests__/tool-approval-libsql.test.ts` (+2 / -3)
- `mastracode/src/agents/__tests__/model.test.ts` (+57 / -0)
- `mastracode/src/agents/extra-tools.test.ts` (+4 / -3)
- `mastracode/src/agents/memory.ts` (+2 / -2)
- `mastracode/src/agents/model.ts` (+6 / -3)
- `mastracode/src/agents/prompts/base.ts` (+3 / -2)
- `mastracode/src/agents/prompts/tool-guidance.ts` (+5 / -2)
- `mastracode/src/harness/config.ts` (+196 / -0)
- `mastracode/src/harness/events.test.ts` (+247 / -0)
- `mastracode/src/harness/events.ts` (+275 / -0)
- `mastracode/src/harness/index.ts` (+13 / -0)
- `mastracode/src/harness/lease-recovery-prompt.ts` (+62 / -0)
- `mastracode/src/harness/observational-memory.ts` (+32 / -0)
- `mastracode/src/harness/runtime.test.ts` (+1496 / -0)
- `mastracode/src/harness/runtime.ts` (+2200 / -0)
- `mastracode/src/harness/subagents.ts` (+40 / -0)
- `mastracode/src/headless-integration.test.ts` (+22 / -0)
- `mastracode/src/headless.ts` (+68 / -24)
- `mastracode/src/index.ts` (+141 / -112)
- `mastracode/src/main.ts` (+34 / -1)
- `mastracode/src/permissions.ts` (+7 / -4)
- `mastracode/src/tool-names.ts` (+9 / -0)
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` (+83 / -0)
- `mastracode/src/tools/request-sandbox-access.ts` (+115 / -25)
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` (+1 / -0)
- `mastracode/src/tui/components/__tests__/om-progress.test.ts` (+6 / -0)
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` (+2 / -0)
- `mastracode/src/tui/components/om-progress.ts` (+1 / -0)
- `mastracode/src/tui/components/tool-execution-enhanced.ts` (+2 / -3)
- `mastracode/src/tui/event-dispatch.ts` (+12 / -1)
- `mastracode/src/tui/handlers/index.ts` (+1 / -1)
- `mastracode/src/tui/handlers/message.ts` (+2 / -1)
- `mastracode/src/tui/handlers/prompts.ts` (+86 / -2)
- `mastracode/src/tui/handlers/tool.ts` (+29 / -15)
- `mastracode/src/tui/mastra-tui.ts` (+49 / -17)
- `mastracode/src/tui/render-messages.ts` (+9 / -2)
- `mc-harness-v1-mc-audit.md` (+1238 / -0)
- `packages/cli/src/commands/api/route-metadata.generated.ts` (+3 / -0)
- `packages/core/src/harness/_shared/message-conversion.ts` (+21 / -5)
- `packages/core/src/harness/v1/builtin-tools/spawn-subagent.ts` (+0 / -1)
- `packages/core/src/harness/v1/errors.ts` (+13 / -0)
- `packages/core/src/harness/v1/events.ts` (+14 / -0)
- `packages/core/src/harness/v1/harness.config-keys.test.ts` (+11 / -0)
- `packages/core/src/harness/v1/harness.ts` (+11 / -0)
- `packages/core/src/harness/v1/index.ts` (+3 / -0)
- `packages/core/src/harness/v1/list-messages.test.ts` (+15 / -19)
- `packages/core/src/harness/v1/session.actions.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/session.events.test.ts` (+43 / -0)
- `packages/core/src/harness/v1/session.goal.test.ts` (+97 / -0)
- `packages/core/src/harness/v1/session.message.test.ts` (+4 / -0)
- `packages/core/src/harness/v1/session.queue.test.ts` (+291 / -0)
- `packages/core/src/harness/v1/session.scheduler.test.ts` (+62 / -1)
- `packages/core/src/harness/v1/session.skills.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/session.skills.use.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/session.spawn-subagent.test.ts` (+15 / -1)
- `packages/core/src/harness/v1/session.suspend.test.ts` (+71 / -2)
- `packages/core/src/harness/v1/session.ts` (+386 / -62)
- `packages/core/src/harness/v1/session.workspace-policy.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/types.ts` (+29 / -0)
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.test.ts` (+2 / -2)
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` (+12 / -9)
- `packages/core/src/storage/domains/harness/types.ts` (+8 / -0)
- `packages/server/src/server/handlers/harness.test.ts` (+6 / -0)
- `packages/server/src/server/handlers/harness.ts` (+3 / -0)
- `packages/server/src/server/schemas/harness.ts` (+8 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
