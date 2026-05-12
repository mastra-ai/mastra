### 6.3 What tools must not do

The harness slot is intentionally narrow. The following are out-of-contract:

- **Mutate state snapshots.** `state`, `getState()` results, and the
functional-updater `prev` parameter are `ReadonlyState<TState>` snapshots.
Mutating nested properties on these objects bypasses `setState`'s durability,
versioning, and eventing guarantees. The runtime may freeze snapshots,
deep-clone, or use another copy-on-read strategy; tools must treat them as
immutable regardless. All durable state changes go through `setState`.
- **Reach into other sessions.** A tool only acts on the session that invoked
it. Cross-session orchestration (e.g. fanning out to N sessions for batch work)
is the harness consumer's job, not the tool's. There's no `harness` reference on
`HarnessRequestContext` for that reason. The sole exception is the read-only,
redacted, ownership-checked descendant projection returned by
`getActivityTimeline({ includeDescendants: true })` under §5.6 / §10.6; that
projection never authorizes parent-chain, sibling-session, or arbitrary
cross-session access.
- **Treat activity entries as proof.** `getActivityTimeline(...)` returns an
advisory read projection, not durable operation evidence. Tools must not use
timeline entries as settlement proof, provider-delivery proof, work-claim
evidence, receipt verification, or a substitute for result lookup. Recovery,
operation evidence, source-row claims, and delivery proofs remain owned by §5,
§10, §13, and source-specific channel contracts. Tools must not synthesize
timeline-derived retry, settlement, or repair loops.
- **Touch `MastraStorage` directly.** Storage is the harness's contract with
persistence — tools mutate session state through `setState`, write files through
`workspace.filesystem` (the core `WorkspaceFilesystem` surface described in
§2.7), and emit events through `emitCustomEvent`. Raw storage access bypasses
the durable-transition guarantees in §5.7.
- **Bypass through a generic Mastra handle.** Harness-managed tool invocations
do not expose the generic `MastraUnion` as `context.mastra` (§6). A
compatibility facade, if present, is not a second Harness authority: tools must
not use it to discover or invoke other agents, workflows, sessions, storage,
provider clients, channel clients, or mutable framework registries outside the
invoking session.
- **Mutate permissions.** Tools cannot grant themselves categories, change
permission rules, or bypass the approval flow. Permission decisions are
user-driven and live on the session.
- **Post directly to channel platforms.** Tools can emit progress or ask for
user input, but user-visible Slack/Discord/Teams delivery goes through the
channel outbox (§14.4). Direct platform API calls bypass retry, idempotency, and
approval routing. For ordinary arbitrary in-process tool code, this is an
authoring and compatibility contract: Harness v1 does not claim a universal
static or runtime fence that prevents a tool from importing an SDK, using
`fetch`, or receiving an application-provided client outside Harness-owned
capability surfaces. The rule is hard-enforced only on surfaces the runtime
controls, such as channel bridge/adapters/outbox dispatch, the channel bridge
admission-time tool-surface strip that omits `AgentChannels.getTools()`
direct-provider tools and rejects matching `addTools` overrides at the §4.2
pre-exposure gate for harness-bound turns (§14.4 outbox dispatch, §14.7
AgentChannels overlap), provider callback ownership, Harness-created channel
tool contexts, legacy `AgentChannels` overlap checks at init (§13.1 and §14.7),
and configured restricted-sandbox or capability-injected tool environments.
- **Switch mode or model.** A tool's job is to do work, not to change the
session's defaults. If a workflow legitimately needs to change mode (e.g. plan
mode → build mode after `submit_plan` approval), that flip happens in the
harness's plan-approval handler, not inside `execute`.
- **Synthesize harness-owned event types.** The `emitCustomEvent` API accepts
only `HarnessCustomEventInput`, and runtime validation rejects built-in names
and reserved internal prefixes. Custom events use a dotted prefix and go through
the `HarnessCustomEventInput` contract.
- **Catch the `suspendTool` interrupt.** The interrupt raised by
`await suspendTool(...)` belongs to the harness/workflow engine. Catching it
leaves `PendingToolSuspension` durably written while the agent turn continues,
desynchronising session state. The harness clears dangling pending fields at
turn-end when the run did not actually suspend, but tools must never
intentionally suppress the interrupt.
- **Set harness-owned event fields.** Tools merely supply `type` and `payload`
through `HarnessCustomEventInput`. The harness fills `id`, `sessionId`,
`timestamp`, `resourceId`, `threadId`, and any subagent attribution fields
required by §10.6. Setting reserved event field names in a custom payload is
allowed at the JSON level, but the harness-owned identity fields take precedence
on the emitted event.
