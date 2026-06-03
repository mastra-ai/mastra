import fs from 'node:fs';
import path from 'node:path';

const root = '.architecture-review/harness-v1';
const raw = path.join(root, 'raw');
const out = path.join(root, 'prs');
fs.mkdirSync(out, { recursive: true });

const order = fs.readFileSync(path.join(raw, 'pr-order.txt'), 'utf8').trim().split(/\s+/).map(Number);

const reviews = {
  16817: {
    before: 'The legacy harness class was named and exported as the primary `Harness` surface. There was not yet a parallel v1 subpath or new runtime stack. Mastra Code imported `Harness` directly from `@mastra/core/harness` and all downstream TUI/headless code expected that one legacy contract.',
    changed: 'Renamed the legacy harness class internally to make room for a new Harness v1 API without immediately breaking existing imports. This was preparatory but touched core harness files and tests.',
    risk: ['Even rename-only PRs can break type exports, declaration generation, or runtime imports.', 'Any accidental public export rename would break Mastra Code because it still imported the legacy harness directly.', 'This establishes the first dual-harness period, which is a long-term compatibility hazard.'],
    retest: ['Mastra Code startup imports `@mastra/core/harness` without ESM/CJS export failures.', 'Legacy harness tests still exercise the same public APIs.', 'Declaration-only bundles preserve old import paths.'],
  },
  16818: {
    before: 'There was no `@mastra/core/harness/v1` subpath. Consumers had only the legacy harness entrypoint.',
    changed: 'Added a Harness v1 subpath scaffold in core package exports/build config. This created the namespace where the new runtime could live independently of the legacy harness.',
    risk: ['Package export maps are easy to break for NodeNext, bundlers, and declaration generation.', 'A new subpath can accidentally shadow or alter existing `@mastra/core/harness` exports.', 'Mastra Code would not use v1 yet, so regressions may only show as import/build failures.'],
    retest: ['Import legacy `@mastra/core/harness` from Mastra Code.', 'Import v1 subpath from an isolated TypeScript fixture.', 'Run package declaration build for core.'],
  },
  16822: {
    before: 'Harness types were legacy-first: events, messages, state, modes, subagents, tools, suspensions, and metadata were centered around the old harness contract.',
    changed: 'Introduced the Harness v1 type layer: session/runtime/task/evidence/state/event contracts that later PRs implement.',
    risk: ['Type layer decisions hard-code semantics before runtime compatibility is proven.', 'If v1 names overlap but differ subtly from legacy names, compatibility adapters can pass type checks while changing behavior.', 'The type layer likely lacks Mastra Code product-specific invariants such as active plan, task list, goals, and signal delivery attributes.'],
    retest: ['Compare v1 event/message/state types against legacy Mastra Code event handlers.', 'Audit whether every legacy suspension kind has a v1 equivalent.', 'Check type exports for stable public API.'],
  },
  16827: {
    before: 'Legacy harness persisted threads/messages/state via existing storage abstractions without a separate v1 storage domain.',
    changed: 'Added Harness v1 storage domain primitives. This starts separating v1 session/run/task persistence from legacy harness persistence.',
    risk: ['Separate storage domains create duplicate sources of truth for thread/session state.', 'Startup/resume can fail if old and new records disagree.', 'Resource ID and project path scoping must match Mastra Code expectations exactly.'],
    retest: ['Create/resume Mastra Code threads across restarts.', 'Switch resources/projects and verify threads do not bleed across projects.', 'Verify fallback LibSQL and Postgres storage both initialize v1 records.'],
  },
  16842: {
    before: 'There was no Harness v1 registry. Runtime ownership was implicit in the legacy Harness instance.',
    changed: 'Added Harness v1 registry infrastructure for sessions/runtimes. This enabled lookup and management of v1 entities.',
    risk: ['Registries introduce lifecycle/ownership issues: stale sessions, duplicate sessions, and wrong owner lookup.', 'Mastra Code later hit stale lease recovery, suggesting registry/session lifecycle risk was real.', 'Cross-process TUI/headless runs can disagree about active session ownership.'],
    retest: ['Start two Mastra Code processes in the same project and verify locking/session ownership.', 'Restart after crash and verify no stale session prevents startup.', 'Clone/switch threads without orphaning sessions.'],
  },
  16845: {
    before: 'Legacy harness state was a single mutable `MastraCodeState` object accessed through `harness.getState()` / `setState()`.',
    changed: 'Added v1 session state. This is the first direct alternative owner for state values.',
    risk: ['This is a critical split-brain point: Mastra Code state can now exist in both legacy-compatible harness state and v1 session state.', 'Fields like modelId/modeId/tasks/yolo/permissions may drift unless every setter is bridged.', 'Later fixes for model preservation, subagent model state, and task state divergence strongly indicate regressions here.'],
    retest: ['Mutate every MastraCodeState field via TUI commands and verify dynamic agent context sees it.', 'Switch thread and verify model/mode/task state remains expected.', 'Run headless with state overrides.'],
  },
  16848: {
    before: 'Legacy harness exposed direct accessors for threads, model/mode, state, and run controls.',
    changed: 'Added v1 session accessors. This made sessions externally queryable/mutable in the v1 model.',
    risk: ['Accessor names can look equivalent while returning session-local values instead of composed legacy values.', 'Missing defensive fallbacks cause crashes when no v1 session exists; PR #17511 later fixed `switchMode` without active session.', 'Accessors can bypass legacy hooks/events if used directly.'],
    retest: ['Call accessors before a session is active.', 'Call accessors after thread switch/clone.', 'Verify legacy-compatible surface still returns complete state.'],
  },
  16853: {
    before: 'Agent thread run output was consumed through legacy harness events/messages and Mastra Code renderers.',
    changed: 'Exposed agent thread run outputs in core, giving v1 a way to represent completed run output.',
    risk: ['Run output shape can diverge from the TUI message stream.', 'Headless `json`/`stream-json` output may omit final text or duplicate deltas if output and events are both consumed.', 'Subagent result rendering depends on stable output semantics.'],
    retest: ['Headless text/json/stream-json final output.', 'TUI final assistant message rendering.', 'Subagent result output after tool-heavy run.'],
  },
  16879: {
    before: 'Harness v1 foundation branches existed in pieces but were not yet synchronized into a combined stack.',
    changed: 'Synced the latest Harness v1 runtime foundation into the stacked branch.',
    risk: ['Foundation sync PRs can silently change assumptions from earlier PRs without focused Mastra Code tests.', 'This likely pulled in cross-cutting runtime behavior before the Mastra Code adapter existed.', 'Large stack syncs make later regressions hard to bisect.'],
    retest: ['Run the complete v1 core test suite after sync.', 'Diff event/state contracts against the prior branch tip.', 'Check generated declaration output.'],
  },
  16881: {
    before: 'Event IDs were either legacy harness implementation details or ad hoc event payload fields.',
    changed: 'Added Harness v1 event ID helpers.',
    risk: ['Event identity affects dedupe, ordering, replay, and UI component updates.', 'If IDs are regenerated during projection, TUI can duplicate or fail to update components.', 'Replay/observability can link the wrong event to tool state.'],
    retest: ['Tool start/update/end component reconciliation.', 'Message delta ordering.', 'Replay or persisted event hydration.'],
  },
  16882: {
    before: 'Admission/approval state lived in legacy harness suspension/tool approval flows.',
    changed: 'Added Harness v1 admission storage.',
    risk: ['Approval/admission storage can desync from legacy pending approval UI.', 'Decisions may resume the wrong run if IDs differ.', 'Permissions can appear approved in one layer and blocked in another.'],
    retest: ['Tool approval approve/deny in TUI.', 'Headless auto-approval.', 'Abort while approval is visible.'],
  },
  16890: {
    before: 'Mastra Code supported image/file attachments through legacy message parts and TUI `[image]` markers.',
    changed: 'Added Harness v1 attachments support.',
    risk: ['Attachment parts can be dropped or malformed during legacy/v1 message projection.', 'Signal data part hydration later required a fix, indicating message part handling is fragile.', 'OM attachment observation depends on correct media/text part preservation.'],
    retest: ['Paste image into TUI and verify model receives it.', 'Headless text file input / attachment handling if applicable.', 'OM observeAttachments auto/on/off behavior.'],
  },
  16894: {
    before: 'Legacy harness messages were the canonical chat stream representation for Mastra Code.',
    changed: 'Added Harness v1 session messages.',
    risk: ['This is a major compatibility seam: TUI rendering, headless output, thread history, and memory all depend on message shape.', 'If v1 messages do not preserve legacy metadata/data parts, features break without type errors.', 'Message-first APIs later changed again, increasing churn.'],
    retest: ['Render existing messages after restart.', 'Thread history sent to model.', 'Signals and multimodal parts in messages.'],
  },
  16895: {
    before: 'Signals were delivered through existing agent/harness signal mechanisms with Mastra Code-specific delivery labels (`while-active` vs `message`).',
    changed: 'Added Harness v1 session signals.',
    risk: ['Signal delivery timing is user-visible: active-run interjections must be tagged and routed correctly.', 'Signals can become normal messages or vice versa.', 'GitHub signals and notification inbox later depend on this path.'],
    retest: ['Send user message while agent is active.', 'Slash commands during active run.', 'Signal data part hydration and delivery attributes.'],
  },
  16896: {
    before: 'Legacy harness handled run/message queues and TUI had a manual follow-up queue.',
    changed: 'Added Harness v1 session queue.',
    risk: ['Two queues can reorder or duplicate messages.', 'Ctrl+F/manual queued follow-ups and active-run signals have different semantics.', 'Queue persistence can restart old messages unexpectedly.'],
    retest: ['Enter during active run sends signal, Ctrl+F queues.', 'Queued follow-up executes after run end once.', 'Abort clears or preserves queue according to legacy behavior.'],
  },
  16897: {
    before: 'Mastra Code permissions lived in `MastraCodeState.permissionRules`, session grants, and YOLO policy.',
    changed: 'Added Harness v1 session permissions.',
    risk: ['Permission policy can now be enforced in two layers.', 'YOLO can be ignored if v1 checks do not read the legacy state; PR #17042 later fixed YOLO approvals.', 'Session grants may not map to actor/session-scoped permissions.'],
    retest: ['YOLO toggle then execute command.', 'Per-tool allow/ask/deny.', 'Temporary approval/session grants.'],
  },
  16898: {
    before: 'Legacy harness represented tool approvals, ask_user, plan approval, and sandbox access as suspensions/events consumed by TUI/headless.',
    changed: 'Added Harness v1 session suspensions.',
    risk: ['Suspension projection must preserve every prompt-specific field. Later fixes around `selectionMode` and sandbox workspace context prove this was risky.', 'Incorrect suspension IDs cause responses to no-op or resume wrong execution.', 'Inline prompt rendering can break if event kinds differ.'],
    retest: ['ask_user single_select and multi_select.', 'submit_plan approval.', 'request_access with allowed paths.', 'Tool approval while multiple tools pending.'],
  },
  16899: {
    before: 'Mastra Code used workspace and custom dynamic tools with Mastra Code-specific names and hook wrappers.',
    changed: 'Added Harness v1 built-in tools.',
    risk: ['Canonical v1 tools can collide with Mastra Code remapped tool names or bypass hook wrappers.', 'Tool taxonomy may not match Mastra Code permission categories.', 'Tool result rendering expects Mastra Code formats.'],
    retest: ['All core tools listed in model prompt with expected names.', 'Hooks fire pre/post for tool calls.', 'Permission prompts use Mastra Code categories.'],
  },
  16901: {
    before: 'Mastra Code had TUI display state/components but no v1 display state abstraction.',
    changed: 'Added Harness v1 display state.',
    risk: ['Display state can duplicate TUI state and drift.', 'Generic display events may not map to existing pi-tui components.', 'Future compatibility code may treat display state as source-of-truth even though MastraTUI owns rendering.'],
    retest: ['Tool progress rendering.', 'OM progress rendering.', 'Subagent display state.', 'Resume thread and render existing UI state.'],
  },
  16902: {
    before: 'Mastra Code implemented goal mode in TUI `GoalManager` and persisted it in thread metadata.',
    changed: 'Added Harness v1 goals.',
    risk: ['Two goal systems can conflict: core v1 goals and Mastra Code TUI goals.', 'Thread metadata persistence must remain compatible.', 'Judge loop continuation/waiting/done semantics are product-specific.'],
    retest: ['/goal start/status/pause/resume/clear.', 'Goal persistence across thread switch/restart.', 'Judge failure resume retrigger behavior.'],
  },
  16912: {
    before: 'Harness v1 existed as stacked pieces; main did not have the full runtime. Mastra Code still relied on legacy Harness.',
    changed: 'Massive core runtime integration of Harness v1. This pulled together type layer, storage, registry, sessions, messages, signals, queue, permissions, suspensions, tools, display state, and goals.',
    risk: ['Very large diff makes semantic regressions hard to isolate.', 'Core runtime was introduced before Mastra Code runtime adoption was fully proven.', 'Any v1 contract mismatch is inherited by all later compatibility work.'],
    retest: ['Full core harness v1 suite.', 'Legacy harness API compatibility.', 'Mastra Code startup before adapter.', 'Storage migrations/fallbacks.'],
  },
  16933: {
    before: 'Mastra Code imported and returned legacy `Harness` directly. There was no Mastra Code `HarnessCompat` adapter.',
    changed: 'Added the first Mastra Code Harness v1 adapter/compatibility layer and updated Mastra Code integration/tests around it.',
    risk: ['This is the first product-facing bridge. It likely had incomplete parity for state, events, suspensions, subagents, and headless behavior.', 'A compatibility layer can make broken behavior look superficially correct by preserving method names.', 'Every Mastra Code feature now depends on adapter projection fidelity.'],
    retest: ['Interactive startup and first message.', 'Headless prompt with auto approvals.', 'Thread creation/switch/clone.', 'Tool approvals and sandbox access.', 'Mode/model switching.'],
  },
  16943: {
    before: 'Mastra Code had an adapter branch but was not fully promoted onto the native v1 runtime.',
    changed: 'Ran Mastra Code on the Harness v1 runtime, adopting v1 subagent spawning, runtime controls, modified-file tracking, OM progress bridging, and event bridge hardening.',
    risk: ['This is the highest-risk product migration PR. It changed runtime ownership across TUI, headless, tools, subagents, OM, and event rendering.', 'Native v1 subagents can conflict with legacy/v0 subagents; later PRs explicitly kept v0 subagents out of v1.', 'Runtime controls and event bridge changes can break abort, approvals, and progress UI.'],
    retest: ['Complete smoke test: TUI chat, tool call, edit, shell, approval, abort.', 'Subagent invocation and model selection.', 'OM observation/reflection progress.', 'Modified files/diff command.', 'Headless formats.'],
  },
  17068: {
    before: 'Startup could encounter stale Harness v1 session leases after crashes/restarts.',
    changed: 'Added recovery from stale Harness v1 session leases on startup.',
    risk: ['Confirms v1 session ownership/lease lifecycle was breaking startup.', 'Recovery must not steal active sessions from another live Mastra Code process.', 'Thread locks and v1 leases need consistent semantics.'],
    retest: ['Kill Mastra Code mid-run, restart same project.', 'Run two processes concurrently.', 'Recover with LibSQL and PG storage.'],
  },
  17042: {
    before: 'The initial runtime adoption had startup/resume and workspace/project path issues, plus YOLO/sandbox context gaps.',
    changed: 'Stabilized Mastra Code Harness v1 startup/resumes, preserved project-path workspace context, restored YOLO resume permissions, and fixed sandbox access workspace context.',
    risk: ['This PR is evidence that the first migration broke core startup/resume and permission behavior.', 'Workspace context bugs are especially dangerous because they can grant/deny wrong filesystem paths.', 'YOLO mismatch means permission state was not being read consistently.'],
    retest: ['Resume a thread after restart.', 'request_access then use newly allowed path.', 'YOLO then run execute_command without prompt.', 'Project root and cwd in system prompt/tools.'],
  },
  17090: {
    before: 'Custom Harness v1 mode agents did not reliably receive Mastra Code runtime memory/pubsub context.',
    changed: 'Propagated runtime memory and pubsub to custom Harness v1 mode agents.',
    risk: ['Custom mode agents could run without OM, storage, or signal routing.', 'Dynamic memory factory depends on request context; missing propagation changes model behavior silently.', 'Pubsub gaps break signal delivery and cross-process thread updates.'],
    retest: ['Custom mode with memory enabled.', 'Signals while custom mode agent runs.', 'OM observer/reflector with custom model settings.'],
  },
  17141: {
    before: 'Harness heartbeat handling was incomplete in the runtime refresh branch.',
    changed: 'Added harness heartbeat handlers and Mastra Code heartbeat integration.',
    risk: ['Heartbeats affect gateway sync and long-lived session health.', 'Duplicate or missing heartbeat handlers can cause background work to run too often or never.', 'Cleanup on exit must stop heartbeat timers.'],
    retest: ['Gateway sync heartbeat starts once.', 'Exit cleanup stops workers/heartbeats.', 'Long-running run does not leak timers.'],
  },
  17276: {
    before: 'V1 session ownership was not scoped strongly enough for multi-owner/session scenarios.',
    changed: 'Added scoped Harness V1 session owner IDs across core and Mastra Code. Updated `HarnessCompat` and startup integration.',
    risk: ['Owner IDs are another axis of session lookup. A mismatch can make Mastra Code read the wrong session or fail to find one.', 'Thread switching, clone, subagents, and forks all need correct owner scoping.', 'This can break existing persisted sessions unless migration/defaulting is careful.'],
    retest: ['Start TUI, subagent, and headless flows in same project.', 'Clone/fork thread and verify owner ID separation.', 'Resume old pre-owner sessions.'],
  },
  17290: {
    before: 'Harness v1 event APIs were not fully exposed as core public primitives.',
    changed: 'Added Harness v1 events.',
    risk: ['Event API changes affect the entire TUI bridge.', 'If event kinds/payloads drift from legacy handlers, UI silently drops updates.', 'Event ordering and IDs affect tool/message reconciliation.'],
    retest: ['All TUI handler event categories.', 'Tool streaming and shell output.', 'Subagent event display.'],
  },
  17402: {
    before: 'Session message/queue APIs existed in earlier stacked branches but were not mainline public APIs on current main.',
    changed: 'Added harness v1 session message and queue APIs, with `HarnessCompat` changes.',
    risk: ['Message and queue APIs directly affect active-run user messages, queued follow-ups, headless output, and history hydration.', 'Open PR means the current branch may be testing a not-yet-merged behavior shape.', 'If `HarnessCompat` routes through v1 sessions, legacy fallbacks become critical.'],
    retest: ['Active-run while-active messages.', 'Manual queued follow-ups.', 'Render history after restart.', 'Headless `--continue`.'],
  },
  17411: {
    before: '`HarnessCompat` still delegated or composed state incompletely; v1 session state and legacy state could diverge.',
    changed: 'Composed Harness v1 session state into the compatibility surface and added state/workspace handling.',
    risk: ['This is a direct split-brain fix and therefore very suspicious: it changes what `getState()` returns and where `setState()` writes.', 'Composed state can hide stale underlying owners.', 'Later fixes for subagent model state, model preservation, and task state show composition was incomplete.'],
    retest: ['Every command that calls `setState()` then run dynamic tools/instructions.', 'Thread switch preserves current model.', 'Task tools mutate rendered state and prompt-injected task list.', 'Workspace updates after sandbox access.'],
  },
  17511: {
    before: '`HarnessCompat.switchMode()` assumed an active v1 session existed.',
    changed: 'Fell back to legacy `switchMode` when no v1 session is active.',
    risk: ['Confirms compat methods can be called before/without v1 session initialization.', 'Other methods may have the same missing fallback bug.', 'Mode switching during startup/thread creation remains timing-sensitive.'],
    retest: ['Switch mode immediately on startup.', 'Switch mode after thread change but before first run.', 'Headless `--mode` with no existing session.'],
  },
  17534: {
    before: 'V1 session records/tools/subagent handling had rough edges after state composition.',
    changed: 'Refined Harness v1 session records and tools; touched `HarnessCompat`, agents, index, and core session/tool code.',
    risk: ['Open PR means this may be a moving target but it changes exactly the danger zones: session records, tool surfacing, subagent interaction.', 'Tool refinement can break permissions/hooks/rendering.', 'Subagent refinement can reintroduce v0/v1 duplication or wrong model routing.'],
    retest: ['Tool list/schema snapshot in prompt.', 'Tool approval and hook wrapping.', 'Subagent start/tool/end UI.', 'Session record persistence after restart.'],
  },
  17541: {
    before: 'Task state in `MastraCodeState.tasks` could diverge from v1 session state.',
    changed: 'Synced task state to V1 session in `HarnessCompat`.',
    risk: ['Confirms task state split-brain was real.', 'If tasks require special sync, other state fields may still be divergent.', 'Prompt-injected current task list, TUI TaskProgress, and task tools can disagree.'],
    retest: ['task_write/update/complete/check sequence.', 'Thread switch after task update.', 'Prompt injection contains latest task list.', 'Subagent/task tools do not leak tasks across threads.'],
  },
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function bullet(items) {
  return items.map(x => `- ${x}`).join('\n');
}

function fileList(files) {
  return files.map(f => `- \`${f.path}\` (+${f.additions ?? '?'} / -${f.deletions ?? '?'})`).join('\n');
}

for (const [idx, num] of order.entries()) {
  const j = JSON.parse(fs.readFileSync(path.join(raw, `pr-${num}.json`), 'utf8'));
  const r = reviews[num];
  if (!r) throw new Error(`missing review ${num}`);
  const commits = (j.commits ?? []).map(c => `- \`${c.oid?.slice(0, 10) ?? ''}\` ${c.messageHeadline ?? c.message ?? ''}`).join('\n') || '- No commit metadata returned by GitHub CLI.';
  const files = fileList(j.files ?? []);
  const statusNote = j.state === 'MERGED' ? `Merged at ${j.mergedAt}` : `${j.state}; treat as stacked/unmerged unless absorbed by another PR.`;
  const filename = `${String(idx + 1).padStart(2, '0')}-pr-${num}-${slug(j.title)}.md`;
  const content = `# PR #${num}: ${j.title}\n\n` +
`Source: ${j.url}\n\n` +
`Order: ${idx + 1} of ${order.length}\n\n` +
`Status: ${statusNote}\n\n` +
`Stack edge: \`${j.baseRefName}\` -> \`${j.headRefName}\`\n\n` +
`Diff size: +${j.additions} / -${j.deletions}; ${j.files?.length ?? 0} changed files.\n\n` +
`## Before\n\n${r.before}\n\n` +
`## What changed\n\n${r.changed}\n\n` +
`## Why this is suspicious\n\n${bullet(r.risk)}\n\n` +
`## Feature surfaces to retest\n\n${bullet(r.retest)}\n\n` +
`## Commit headlines\n\n${commits}\n\n` +
`## Changed files\n\n${files}\n\n` +
`## Review stance\n\nTreat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.\n`;
  fs.writeFileSync(path.join(out, filename), content);
}
