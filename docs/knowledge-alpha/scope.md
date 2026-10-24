# Knowledge alpha scope, v19 (report 20261023T223907)

Everything here was checked against main `b1244bd3bc0`.

v12 follows Tyler's comment on Kayle's dogfood plan (v45), which supersedes v5–v11's scope model:

- Scope types come from the Knowledge structure (`org:$orgId`, `team:$orgId:$teamId`, `project:$projectId`), with `$param` patterns only. Nothing is hard-coded; only `resource` and `thread` are conventions, and Knowledge adds them from the run.
- `canonicalizeKnowledgeScope` stops rejecting; the org throw goes.
- Knowledge tools take a `scope` argument, bounded by the scopes the agent threads through.
- A scope can own other scopes (org owns teams) through the structure.
- Everything Knowledge leaves Memory for core, including the pins state-signal provider, and pins work without Memory.

v19 adds Tyler's decision that scopes can carry read/write access (§3c, D15). v18 folds Fayth's v14 review (Factory declares and stamps its own `project:` tag, D14; D9 migrate warning; D13 union with future grants). v17 folds Fayth's v13 review (atomic per-message scope admission, own-run wait, FIFO, host-authorized remote scopes, LibSQL timeout limits). v16 drops the `*` wildcard (Tyler approved `$param` only). v15 folded Fayth's v12 review (ownership binding, runner in-run path, remaining Factory readers). v14 removes the built-in project scope (Tyler) and adds D13, how org-owns-team is held. v13 added the Director dogfood gap list (Kayle): a scope per message on long-lived sessions, many processes on one LibSQL file, an explicit off switch, and undeclared tag types (D12).

Carried from earlier versions: Knowledge reads the run's tagged scopes; `organizationId` and `knowledgeResourceId` are deleted; pins stay a prompt-cacheable state signal; Knowledge ships its own usage instructions (section 3b).

## 1. Delete Subconscious

**Don't delete by name match.** `subconscious` is also the name of a model provider. These files stay:

- `docs/.../models/providers/subconscious.mdx`
- `core/src/llm/model/capabilities/subconscious.json`
- `provider-registry.json` and `provider-types.generated.d.ts`
- `observability/mastra/pricing-data.json`

**Memory, `packages/memory/src/processors/observational-memory/subconscious/`.** Delete 11 modules: `activity`, `curate`, `index`, `model`, `origin`, `remind`, `remind-agent` (`ask_memory`), `remind-continuation`, `remind-protocol`, `remind-questions`, `types`. Six more move into core (section 2a).

Four of the deleted modules have callers outside the folder:

1. **`origin.ts`.** `observation-strategies/base.ts:21,179` calls `stripSubconsciousSignals` to keep persisted Subconscious signal messages out of the observer's input, and existing Mastra Code threads contain those messages. **Keep the protection.** I inline the strip as a private helper in OM (D8).
2. **`activity.ts`.** Remove its re-exports from OM `observational-memory/index.ts:44-60`.
3. **`remind-protocol.ts`.** `Memory.deleteThread` (`index.ts:1183-1186`) uses it to delete the remind threads a thread owns. **Keep that cleanup.** I inline the two helpers so deleting a thread doesn't leave remind threads behind (D8).
4. **`memory/src/index.ts`.** Remove the Subconscious code at `:67-70`, `:103-114`, `:132` (`experimental_subconscious`), `:555-600`, `:669-674`, `:2418`, `:3115-3128` (`ask_memory`) and `:4357-4374` (pins processor).

The OM hook `onReflectionCommitted` (`types.ts:1222`, `reflector-runner.ts:251-314` and `:1170-1172`, `observational-memory.ts:875`) exists only for Subconscious, so it goes too.

**Mastra Code SDK.** Delete `new Subconscious(...)` and `hasSubconsciousTools` in `agents/memory.ts:247-255, 383, 418-423`, and the Subconscious lines in `index.ts:65, 879-882, 1322`, `agents/prompts/tool-guidance.ts` and `agents/instructions.ts`. **Then rewire the SDK, which is new work:** Mastra Code agents get a `Knowledge` attached with read, write and pins on, so they keep their knowledge tools and pins (D5).

**TUI.** Delete `components/subconscious-activity.ts` and `render-messages.ts:36-38, 525-530`. Old threads hold persisted `subconscious-activity` state signals, so the renderer skips them silently rather than printing raw signals (D8). Remove `e2e/tui/subconscious-activity-rendering.ts` and its entries in `e2e/tui/{index,types}.ts`.

**Factory.** `routes/knowledge.ts:43-44` keeps its own `PINNED_NODE_NAME = 'pinned'` copy; only a comment points at the Subconscious file, so nothing breaks. Update the comment and dedupe the constant against core's. Update `factory-ui/e2e/knowledge/explore.spec.ts`.

**Tests, scripts and docs.**

- Delete about 25 OM `__tests__/subconscious-*.test.ts`.
- Delete `scripts/simulate/{replay,drive}.ts`.
- Delete the integration tests `subconscious-libsql` and `knowledge-wave-1-real-curate.mts`.
- Port `pinned-proof`, `subconscious-pins-libsql` and `knowledge-v2-wave-1` to the new API.
- Remove the Subconscious sections from `docs/.../memory/observational-memory.mdx` and `docs/src/mastra-code/index.mdx`.

**Breaking change.** `experimental_subconscious: new Subconscious(...)` appears in the published @mastra/memory changelog (`CHANGELOG.md:~1614-1620`). The changeset must say it's removed (D6).

## 2a. Move into `packages/core/src/knowledge`

Move `knowledge-tools`, `knowledge-write-tools`, `pinned`, `pinned-state-processor` (the pins state-signal provider, section 3) and `semantic-index`. After the alpha `@mastra/memory` holds no Knowledge code. Delete `scope.ts`, the `knowledgeResourceId` reader. All five import only `@mastra/core/*` and `json-schema`, so core needs no new dependencies. It belongs in core and not a new package because `Agent` has to attach it, and the storage contract already lives there.

## 2b. The API

```ts
const company = new Knowledge({
  id: 'company',
  storage,
  vector,
  embedder, // optional; without them search is keyword-only
  tools: { read: true, write: false }, // what an attached agent gets
  pins: { maxPins: 20, maxTokens: 500 }, // or true / false
})
new Agent({ knowledge: company /* or a registered key */ })
const tools = company.createTools({ write: true }) // explicit wiring
```

- `tools`, `pins`, `vector` and `embedder` are **all new options on `KnowledgeConfig`** (main has id, name, description, structure, `scopes?: KnowledgeScopeTypesConfig` and storage; `core/knowledge/config.ts`). `vector` and `embedder` exist only on Memory today.
- Tools merge next to `workspaceTools` in `agent.ts:7369-7379`.
- An agent with Knowledge and no Memory gets no "no memory configured" warning (`agent.ts:8760`).

## 3. Scopes come from the run and the Knowledge structure

Tyler's direction (comment on Kayle's dogfood plan v45): scopes are never hard-coded; the Knowledge structure defines them (`org:$orgId`, `project:$projectId`, …; Tyler later approved `$param` only, no `*` wildcard); only `resource` and `thread` are known conventions, from Memory; Knowledge tools take a `scope` argument threaded through from the agent; an org scope can own team scopes and access them.

**Knowledge reads the run's scopes, and nothing else.**

- On main, agent methods already take `scopes: string[]` (`agent.types.ts:467-472` for generate/stream, `:620-625`), Agents take `scopes` (`types.ts:838-841`), and `mastra__scopes` carries them in the request context. `resolveAgentScopes` (`agent/scopes.ts:201-215`) unions the three. Each tag is `<type>:<value>`, e.g. `org:acme`, `team:director`, `request:r25`. The value may itself contain `:` (`team:acme:director`).
- `setRunAgentScopes` (`scopes.ts:59`, from #26593) writes the run's non-identity tags onto the run's copy of the request context under `mastra__scopes`, via `deriveAgentRunRequestContext` (`:286`). The array object goes into a WeakSet (`runScopeValues`, `:51-56`). `restoreRunAgentScopes` (`:68`) re-marks it after a durable resume.
- **The reader:** a new `getRunAgentScopes(requestContext)`, about 10 lines in `agent/scopes.ts`. It returns the tags only if that exact array is in the WeakSet, otherwise `[]`. A caller that writes `mastra__scopes` itself, or sends it as JSON, gets nothing. Tools and the pins processor call it on every execution. Wave 2 has the same function (section 5).
- **`resource` and `thread` are added by Knowledge.** Core resolves the run's resourceId/threadId (`scopes.ts:236-264`) but strips `resource:`/`thread:` from the downstream `mastra__scopes` (`withoutIdentityAgentScopes`, `:274`). So the run's Knowledge scope = the reader's tags + `resource:<resourceId>` and `thread:<threadId>` when the run has them. These are the only two built-in conventions.
- **`organizationId` and `knowledgeResourceId` are deleted**: the request-context keys, the SDK stamping (`sdk/agents/memory.ts:306-319`), `subconscious/scope.ts`. An org is an `org:` tag like any other, and nothing requires one.

**The structure defines scope types; nothing is hard-coded.**

- Main already has the place for this: `KnowledgeConfig.scopes?: KnowledgeScopeTypesConfig` (`knowledge/config.ts:14`), patterns like `'team:$teamId'` with `access` and `children` (`knowledge/reconcile.ts:9-35`). What's hard-coded today, and goes:
  - `BUILT_IN_SCOPE_TYPES` (`reconcile.ts:45-50`) lists `org:$orgId`. It keeps only `resource:$resourceId`, `thread:$threadId` and `custom`.
  - `IDENTITY_SCOPE_PATTERNS` (`reconcile.ts:195`) lists `org:$orgId`. It keeps only resource and thread.
  - In the store: `KnowledgeScopeLevel = 'org'|'resource'|'thread'` (`storage/domains/knowledge/base.ts:6`), `SCOPE_ORDER` (`:680`), the level check and throw in `canonicalizeKnowledgeScope` (`:693`), one-entry-per-level (`:697-700`), the ancestor rules (`:706-711`), `expandKnowledgeScope` (`:748`). All removed (section 3a).
- **Undeclared tags work.** (`custom` is read only when materializing nodes, `materializeKnowledgeScopePlan`, `reconcile.ts:134-150`; the runtime ownership check never reads it: an undeclared tag is usable only by a run holding it.) A run can read and write a tag type the structure doesn't declare. It falls to `custom` (main's existing fallback, `reconcile.ts:135-150`), which gives the holder owner rights over its own tag and nothing more. Declaring a type adds what the structure can say about it: a description, `children` templates, and **who owns it** (below). Only ownership needs a declaration: an undeclared type can't be owned by another scope. D12 offers a strict mode instead.
- **Patterns are `$param` only** (Tyler). `matchPattern` (`reconcile.ts:224-240`), `assertPattern` (`:257-271`) and `patternsOverlap` are unchanged: no `*` wildcard is added.

**Ownership: a scope can own other scopes.**

- Declared with main's existing `access` on a scope type, whose `principal` already accepts a pattern string (`KnowledgeScopeAccessConfig`, `reconcile.ts:9-13`), and main's roles `readonly | append | edit | owner`:
  ```ts
  scopes: {
    'org:$orgId': { description: 'The company' },
    // tenant-bound: the team address carries its org, so only that org owns it
    'team:$orgId:$teamId': { access: [{ principal: 'org:$orgId', role: 'owner' }] },
    // an app that wants projects declares them; the alpha has none built in
    'project:$projectId': { description: 'A project' },
  }
  ```
- **The check** (new, in core Knowledge, about 30 lines): a run may use scope `S` if it holds `S`, or it holds a tag that matches an `access` principal on `S`'s type, with `$params` bound from `S`'s own address. `org:acme` owns `team:acme:director` but not `team:other:director`. Reads need any role; writes need `append` or more; remove, rescope and merge need `edit` or more.
- **Binding rules**, so a named scope can't manufacture ownership:
  - Any segment that **starts with** `$` (`$x`, `$x-y`) is refused in any run tag or `scope` value (shape check in canonicalize and in the tools' `scope` validator), because `matchPattern` treats any `$`-leading segment as a capture (`expected.startsWith('$')`); a named scope can't look like a pattern.
  - After `$params` are bound from `S`, the principal is compared to the held tag by **exact string equality**. With no wildcard, a principal that binds to `org:acme` is owned only by a run holding exactly `org:acme`.
  - A principal that uses a `$param` its type's pattern doesn't bind is **skipped at call time** (it grants nothing), not refused at construction. Host-vouched structures already use such principals (for example `team:$orgId` on `agent:$agentId:public`, bound when the host materializes the scope), so a construction-time refusal broke existing reconcile tests. `ownedKnowledgeScopeRole` (`reconcile.ts`) never calls `substituteParameters` with an unbound parameter.
  - The `self` and `parent` principals resolve against materialization input (`resolvePrincipal`), which the call-time check doesn't have. The check ignores them: holding the scope already covers `self`, and `parent` stays a materialization-only notion.
  - Tags with extra `:` in the value (`resource:x:uncurated`) don't match a pattern by segment count and fall to `custom`.
  - Run tags plus named owned scopes can exceed the 8-entry cap. The tool reports that as a tool error naming the cap rather than letting the store throw.
- **No stored grants read at run time.** Ownership is computed from the instance's config at call time. Correction to earlier versions: main already _stores_ structure and grants on LibSQL and PG as well as InMemory (`supportsV2: true`, LibSQL `reconcileStructure` `stores/libsql/.../knowledge/index.ts:518`, grants written `:606`; PG `reconcileStructure` `stores/pg/.../knowledge/index.ts:754`, grants written `:843`, flag `:574`); MySQL and MongoDB don't (their knowledge domains have no `supportsV2`, `reconcileStructure` or `grants`, so the base default `supportsV2: false`, `base.ts:911`, applies). What main lacks is enforcement: nothing reads stored grants on a read or write (`base.ts:807-812`, "Grant-based write enforcement is not implemented yet"), and grants come only from the structure plan, with no API to add one at run time. Stored grants in the alpha would mean adding that enforcement and an add/revoke API on LibSQL/PG/InMemory, with no schema change; MySQL/Mongo would refuse structures that declare grants.
- **Director dogfood:** the director's run holds `org:self` + `team:self:director`; members hold `{ tag: 'org:self', access: 'read' }` + `team:self:<team>` (plus `agent:`, `project:`, `request:` and Memory's `resource:`/`thread:`), never `org:self` writable (§3c). With `'team:$orgId:$teamId'` owned by `org:$orgId`, the director can read and write every team's Knowledge by naming the team scope (next); a member reaches only its own team. Shared seed content lives at the team scope, not at `org:self`.
- **Holding an owner tag is a capability.** A run holding a principal tag reaches every scope that tag owns, so a host stamps an owner tag (here `org:`) only on runs meant to have that reach. An org tag is not a general shared-read level once it owns other scopes.

**The `scope` argument on Knowledge tools.**

- Every read, write and pin tool takes `scope?: string[]`. Knowledge builds the call's scope from it:
  - **Reads** query `run tags ∪ scope`. Each extra tag must be one the run owns. Naming `team:self:director` lets the director search that team's records; it can't name a scope it neither holds nor owns.
  - **Writes** land at exactly `scope` when given, else at every tag the run holds (the most private placement). Each tag in `scope` must be held or owned with `append`+. Writing at fewer tags shares wider; writing at an owned tag places the record in that scope.
  - **Pins** default to every run tag except `thread`, so a pin follows the user across threads.
- **Who supplies it.** "Threaded through from the agent": the run's tags arrive through the agent (`scopes` config, per-call `scopes`, `mastra__scopes`) and bound what `scope` may name, so a model can never reach outside its run and what the run owns. Within that bound the model fills `scope`, because the model is what decides whether a fact is team-wide or private. An app that wants to fix it passes `knowledge.createTools({ scope })`, and then the argument is not exposed. **Factory always fixes it** to its required tags: its tools don't expose `scope`, so a Factory run can't name another project's or org's scope through a tool argument (required tags alone guard only the run's scopes, not tool arguments). Settled by Tyler (D10): "the harness supplies which scopes the agent has access to. the agent may then pick a specific scope from its access to write to or read from."
- Tool schemas list the run's held and owned scope _patterns_ in the description, not values, so they stay stable across runs with the same tag types.

**A scope per message, for long-lived sessions.** A Director member is one Mastra Code session for life, and tasks arrive as messages (`session.sendMessage({ content })`, `agent-controller/session.ts:5380`). Scopes fixed at `createMastraCode` can carry `org:self`, `team:…` and `agent:<name>`, but not `request:<rN>`, which changes per task. Recreating the session per task would lose the conversation.

- `session.sendMessage` gains `scopes?: string[]` and passes them to `sendSignal`, whose idle path already takes `scopes` for the run the signal starts (`agent/types.ts:207-230`, unioned into the run's per-call scopes).
- A run's scopes are fixed when it starts (the active-run `scopes` is validated but not applied, `types.ts:214-217`). So a message whose `scopes` differ from the active run's must not join it.
- **Where that's decided.** In signal admission in `thread-stream-runtime.ts` (the code that already returns `{ action: 'blocked' }`, `:6635-7036`), where the active run is known. Each run records its resolved scopes (the `AgentScopesSnapshot` from `resolveAgentScopes`) on its admission record when it starts. A signal carrying `scopes` that differ from the active run's gets a new reply `{ action: 'blocked', reason: 'scope-mismatch', runId }`. Check and delivery are one step, so there's no race with the run ending or starting. The comparison runs in **every** admission branch that would hand the signal to an active run: the local deliver into a running record (`:6704` path), the suspended-run block (`:6837`), the claimed-owner acceptance (`:6895`), the lost-lease retake (`:6967`), and the reservation that forwards to a real owner as `remote` (`:6747`). A same-agent run owned by **another process** (the `remote` forward, `:6747`) doesn't expose its scopes locally, so a signal carrying `scopes` that would join it gets `scope-mismatch` unconditionally and waits for that run to end. `remoteCrossAgent` (`:6635-6639`) is unchanged: another _agent_ holds the thread, so the signal could never join whatever its scopes; it stays `thread-blocked` and uses `#waitForOtherAgentRun`. That's conservative but never mixes tags; scope-less signals keep today's cross-process delivery.
- **The wait.** On `scope-mismatch`, `sendMessage` waits for **its own session's** run `runId` to end, not on `#waitForOtherAgentRun` (that waits for another agent's run on the thread). Then it resends; if a new run started meanwhile, admission decides again. The loop's existing abort/stop handling still applies. A run kept open by `untilIdle` or background work counts as active, so the message waits for the idle end. There's no timeout; the Director sends a task only after the previous one finishes. The `sendMessage` loop branches on `reason`: `scope-mismatch` waits on its own (or, for a remote owner, that process's) `runId`; `thread-blocked` keeps today's `#waitForOtherAgentRun` path unchanged.
- **Order.** Scoped `sendMessage` calls on one session go through a per-session FIFO, so r2 then r3 sent during r1 start in send order.
- **Only `sendMessage` carries scopes.** The other `sendSignal` callers (`session.ts:4988, 5136, 5253`: follow-ups, notifications) send none, so they join the active run and work under its tags (an `r1` notification stays `r1` work). Same scopes, or none, keep today's behaviour.
- The remote Factory session (`sdk/src/factory/remote-session.ts:391`) passes `scopes` through, but **the host authorizes them first**: tags are authority, so the server accepts per-message scopes only of tag types the host allows (`allowedMessageScopeTypes`, empty by default) and refuses the message otherwise. Factory's `requiredScopes` check still applies on top. Implemented on `AgentController` (`allowedMessageScopeTypes`, checked by the server `messages` route with 403); `@mastra/client-js` `sendMessage({ content, scopes })` and the remote Factory session forward them. The Factory doesn't set the option, so in the alpha a remote Factory message naming scopes is refused; a host that wants `request:` tags per message sets `allowedMessageScopeTypes: ['request']`.
- Knowledge then sees the message's tags through `getRunAgentScopes`, like any per-call scope. The Director harness sets `scopes: ['request:r25']` on each task message and nothing else changes.

**Session tags in Mastra Code.** The API is `createMastraCode({ knowledge: { instance, scopes? } })`; the `key` goes with Memory's `knowledge` option (D4).

- The SDK sets the agent's `scopes` to the caller's `scopes`. Session tags are passed to the Knowledge attachment as `defaultScopes` (Factory: `requiredScopes`), and Knowledge applies them right after `getRunAgentScopes`, on the union of all three sources (an Agent-level resolver can't see the per-call option).
- A default is added for each tag _type_ the union lacks, **but only when the union holds no caller-supplied tag other than `resource:`/`thread:`**. A plain local TUI/studio session (no tags) defaults `org:local`, so existing local Knowledge stays visible. Any caller-supplied tag (`org:self`, or just `team:self:x`) turns the defaults off, so a host that stamps its own tags never gets `org:local` mixed in. Factory's `requiredScopes` are unaffected: they're required, not defaults.
- Writes with no `scope` land at every writable run tag, including `agent:`, `resource:` and `thread:`, so they're private to that run's identity. Knowledge meant for the team is written with `scope: ['team:self:x']`; that's what the director reads through ownership.
- **No built-in project scope** (Tyler: "the alpha should not have a builtin project scope"). The SDK requires only `org:<factoryOrg>` for a Factory session; a different `org:` from any source refuses the run with an error naming the tag. Factory's server adds its own `project:` requirement (below). The project used to sit in the resource slot through `knowledgeResourceId`, which is deleted, and the SDK adds no project tag. An app that wants project scopes declares the type in its structure and stamps the tag itself (the Director will stamp `project:<slug>` per task). A Factory session whose org can't be resolved gets no Knowledge, as today.
- **Factory is such an app** (D14). Its Memory resource is per session (`factory.ts:897-898`, `sessionMemoryResourceId`), not the project id, so it can't lean on `resource:` for project isolation. Factory's own server code declares `'project:$projectId'` in its Knowledge structure and stamps `project:<projectId>` on its sessions as a required tag (`requiredScopes: ['org:<org>', 'project:<id>']`), so a differing `project:` from any source is refused, as with `org:`. Generic core and the SDK still add no project tag. The routes in `routes/knowledge.ts` that use `factoryProjectId` (21 places: `defaultScope` `:585`, `pinRungs` `:600-630`, vouching `:660`, `projectScope` `:707`, node matching `:808`, `:873`, `:911`, `:943-950`, `:1016-1024`, `:1105-1114`) switch from `resource:${projectId}` to `project:${projectId}`, so project views keep today's project isolation.
- Factory Knowledge already written under `resource:<projectId>` goes out of view (D9).
- **Off means off.** Knowledge is off when no instance is passed and `MASTRACODE_EXPERIMENTAL_KNOWLEDGE` is unset. `createMastraCode({ knowledge: false })` turns it off even when the flag is set, so a session can deliberately run without Knowledge. Off means no tools, no pins, no instructions block and no store opened.

**Many processes on one LibSQL file** (the Director dogfood: ~15 processes, Tyler's pick of LibSQL).

- Writes: built from `{ url: 'file:…' }` (no `syncUrl`), the store sets WAL and `busy_timeout` = `connectionTimeoutMs`, default 5000 ms (`storage/index.ts:236-241, 327-331`, `db/index.ts:73`). Every Knowledge transaction is `transaction('write')` (`BEGIN IMMEDIATE`, `domains/knowledge/index.ts:1265`), so there's no read-to-write upgrade failure. A writer waits for another process's lock **up to 5 s**; after that the write fails with `SQLITE_BUSY`, which reaches the agent as a tool error (no retry). A longer `connectionTimeoutMs` is the knob.
- A store built from an injected `{ client }` (`storage/index.ts:257-258`) gets no timeout or pragmas, and the in-process file-transaction gate (`shared/file-transaction-gate.ts:27-34`) covers only clients in one process. **The Director must build the store from the URL**, and a test pins that.
- Startup: every process reconciles the structure when it registers (`knowledge/index.ts:60-66`). Only a declared `structure` triggers this, and a lost race only logs a warning. Tagged reads and writes never depend on it. The alpha makes reconcile retry once after a conflict and stay quiet when the other process already wrote the same plan.
- Outbox: one row per write, never drained without a vector store. At dogfood write rates that's small rows growing linearly; pruning stays out of the alpha (section 3b, Search).
- Proof: a smoke test that spawns 4 Node processes on one LibSQL file, each writing 50 records and reconciling at startup at the same time, then checks all 200 records and one structure are present and no process errored. A contention variant holds a write lock in one process longer than the timeout and asserts the other's write fails cleanly with `SQLITE_BUSY`, with no hang and no lost or corrupt rows.

**Tenant isolation.** With no ancestor rule, the store no longer forces an org into a scope, so a record at `[team:director]` is visible to any run holding `team:director`. The guard is the caller: Factory routes and Factory sessions require their org tag (above), with a test. Tenant-bound ownership uses patterns that carry the org (`team:$orgId:$teamId`). Single-tenant apps may leave the org out.

**Factory routes read the scope array, so they change too** (`mastracode/factory/src/routes/knowledge.ts`):

- `deepestRung` (`:316-325`) returns `org` for any scope without `resource`/`thread`. "Rungs" go: the payload reports the record's tags, and the UI groups by tag type.
- `selectedView` (`:636-648`) takes `view.scope.slice(0, 1)` / `slice(0, 2)` as org and resource levels. Rewritten to pick by tag type.
- `withinViewBoundary` (`:327-334`) is an index-by-index prefix test. Rewritten to subset containment.
- `selectedView`'s `pinRungs` filter (`:636-648`) uses rung names. Same rewrite: by tag type.
- `scopeKindLabel` (`:395-401`) maps `resource:` to "project" and everything else to "topic". Rewritten to label by tag type (`resource:` keeps its label for old rows; a declared `project:` type is labelled project).
- `#vouchIdentityScopes` (`:660-690`) materializes an `org:` → `resource:<projectId>` → `thread:` chain. It now vouches `org:<factoryOrg>`, `project:<projectId>` (Factory's own type) and the run's `resource:`/`thread:`, so the tree matches the tags Factory runs hold.
- A Factory route test covers a view with `project:` and no `org:`, labels, and that the vouched tree equals the run's tags. A second test: two projects in one org, a record written in project A's session is not in project B's view or pins.

**Pins move into core and work without Memory.**

- `PinnedStateProcessor` (the pins state-signal provider) moves to `core/knowledge` and stays a state signal: a snapshot first, then deltas, nothing when unchanged. The Agent adds it when its Knowledge has `pins`, de-duplicated by state id.
- **With Memory**, nothing changes: the runner persists signals and `lastSnapshotSignalId` in the thread (`runner.ts:486-560`, `agent/state-signals.ts:149`).
- **Without Memory**, the runner throws today (`runner.ts:496`). The alpha adds an in-run path to the runner: a processor that declares `stateSignalWithoutMemory = true` gets its history from the in-run `messageList` only, its signal is added to the message list and not persisted, and its tracking lives in processor state for the run. Pins declare it; task, goal and browser providers don't, so their behaviour (throw without Memory) is unchanged.
  - Placement in the runner: today it throws at the top when there's no Memory (`if (!resolvedMemory) throw`). The in-run branch sits before that throw, keyed on `processor.stateSignalWithoutMemory`, so every other provider still reaches the throw unchanged. The branch also bypasses the next guard (no `threadId`/`resourceId` ⇒ skip), which would otherwise silently skip pins for the common memoryless run without ids.
  - It doesn't call `applyStateSignal`, which persists through Memory and thread metadata. A new add-to-`messageList`-only function applies the signal and still emits `writer.custom`; `sendStateSignal` (mid-step signals) gets the same in-run branch.
  - Effect: a memoryless agent gets a full snapshot on the **first step** of every call. Steps 2+ of the same run find that snapshot in the `messageList` and emit deltas, including a pin changed by a pin tool mid-run. The snapshot text is deterministic, so repeated calls with the same pins produce the same tokens.
  - Cost: without Memory (and without replay) every call pays the whole pin set, up to `pins.maxTokens`, as input tokens. It's the same text each call, so it stays prompt-cacheable, but it is not the delta-only cost a Memory thread gives.
  - Replay: the signal is part of the run's `response.messages`, as with Memory. A caller that replays them carries the old snapshot into the next call; the next call still finds it in the `messageList` and sends a delta against it. A caller that doesn't replay gets a fresh snapshot.
  - Pin scope without a resource/thread: every run tag. Pins never need an `org`.
- That is a core processor API addition (one optional flag plus the runner branch). It lands in the alpha because Tyler wants plain Knowledge usable, pins included, without Memory.

**Tools without Memory.** `agent.ts:8731-8745` resolves the thread and resource from call options and the reserved request-context ids, and the tool builder passes them through (`tool-builder/builder.ts:637-644, 739-740`). Write tools need a thread, as on main, because records carry their source thread.

## 3c. Scopes can be read-only

**Settled by Tyler** ("maybe our scopes should be able to define read/write? … ok yeah object is probably better"). An entry in any `scopes` array is a plain string (read and write, as today) or an object:

```ts
type ScopeEntry = string | { tag: string; access: 'read' }
scopes: [{ tag: 'org:self', access: 'read' }, 'team:self:director', 'agent:alex']
```

**No write-only access.** A write-only tag would let a run write records it can't read back, so `knowledge_read` on its own write returns `{found:false}` and the agent loses its own context. No Director or Factory case needs it, and it adds a third state to every check. If a "drop box" is ever needed, a scope owned by someone else does it: the writer holds a write-only right through ownership, not a tag. So `access` takes only `'read'`; leaving it out means read and write.

**What `read` means.**

- **Visibility: unchanged.** A read-only tag counts in the query scope exactly like a plain one; a record carrying it is visible under the same subset rule (`isKnowledgeScopeVisible`). Hiding nothing on read is the point.
- **Default writes leave it out.** A write with no `scope` argument lands at every _writable_ run tag. A member holding `[{org:self, read}, team:self:director, agent:alex]` writes at `[team:self:director, agent:alex]`.
- **The model can't write there.** A `scope` argument (D10) naming a read-only tag on a write, append, remove, rescope, merge or pin tool is refused with an error naming the tag ("`org:self` is read-only for this run"). Reads may name it.
- **Ownership needs write.** A read-only tag never acts as an ownership principal (§3, D13). Otherwise a member holding `org:self` read-only could read every `team:self:*` through org's ownership, which is the team-separation hole Kayle found. A read-only `org:self` makes visible only records that carry `org:self`; it reaches no owned scope.
- **Stored keys don't change.** Access lives only on the run. Records, pins and scope keys store bare tags, so `canonicalizeKnowledgeScope` and `knowledgeScopeKey` never see access and no existing key moves. The 8-tag cap counts distinct tags; a tag held read-only counts once.
- **Identity tags stay plain.** `resource:` and `thread:` are Memory's identity and can't be read-only; an object entry for them is refused by `resolveAgentScopes` with `AGENT_SCOPES_INVALID`.

**Where it goes in the API.** One entry type everywhere a list of scopes is accepted:

- Agent `scopes` (`types.ts:838-841`, `DynamicArgument<ScopeEntry[]>`), per-call `scopes` (`agent.types.ts:467-472`, `:620-625`), and `SendAgentSignalOptions.scopes` (`types.ts:207-230`).
- `createMastraCode({ knowledge: { instance, scopes } })` and the session's `defaultScopes`/`requiredScopes`.
- `session.sendMessage({ content, scopes })`; the remote host check (`allowedMessageScopeTypes`) applies to the tag, and the host may also narrow an entry to read.
- `knowledge.createTools({ scope })` takes entries too and only narrows: it can fix a tag as read for these tools, never widen one.
- **Not the model's tool argument.** The `scope` argument the model fills on a Knowledge tool stays `string[]`: the model selects tags, and their access always comes from the trusted run entries (and `createTools` narrowing). An object entry in the model's argument is refused by the tool's schema.
- `parseAgentScope` (`scopes.ts:116`) accepts the object form and normalizes to `{ tag, access: 'read' | 'readwrite' }`; everything downstream uses the normalized form.

**How it's carried in the trusted run context.** `mastra__scopes` stays a `string[]` of tags, so code that reads it today keeps working. Next to it, `setRunAgentScopes` writes `mastra__scopeAccess`, a frozen `Record<tag, 'read'>` listing only the read-only tags, and marks both objects in the same `runScopeValues` WeakSet (`scopes.ts:51-56`). `getRunAgentScopes` returns `{ tag, access }[]` only when both are marked; an unmarked access map is ignored and the run is treated as having no tags at all, so a caller can't forge `readwrite` by dropping the map. `AgentScopesSnapshot` stores the access map, and `restoreRunAgentScopes` (`:68`) re-marks it after a durable resume.

**Combining the three sources** (agent config, `mastra__scopes` request context, per-call option; `resolveAgentScopes` `:201-215`), plus session defaults/required and per-message scopes:

- Trusted (harness) sources: Agent config `scopes`, the marked `mastra__scopes`/`mastra__scopeAccess` pair, per-call `scopes`, session `defaultScopes`/`requiredScopes`, host-authorized per-message `scopes`, and `createTools({ scope })`. The model's tool `scope` argument is the only untrusted input.
- Union by tag. If **any** harness source gives a tag as read, it's read. The narrowest wins; nothing widens a read entry into readwrite.
- The model's `scope` argument only selects from the result and can never widen.
- Resume: the snapshot is authoritative, as today. A resumed run can narrow a tag to read but not widen it; trying to widen throws `AGENT_SCOPES_CONFLICT`.
- Per-message: a message whose entries differ from the active run's, by tag **or** by access, is a `scope-mismatch` (§3) and starts its own run.

**The `org:local` default.** This doesn't replace it. The default (line 132) applies only to a run with no caller tags, so a plain local session still sees local Knowledge; any stamped tag, read-only or not, turns it off. So Director members never get `org:local`, whether or not they hold `org:self` read-only. It does simplify the Director: members hold `{ tag: 'org:self', access: 'read' }` and see the org's shared knowledge without being able to write org-wide or reach the teams org owns. The director session holds `org:self` read/write and decides what's org-wide, plus its team for its own writes.

**Pins.** Pins are records at the pin tags, so pins at a read-only tag are delivered (visible) but not writable. Default pin tags are the writable run tags except `thread`. `knowledge_pin`, `edit_pin` and `unpin` naming a read-only tag are refused, and editing or unpinning a visible pin whose tags include a read-only tag is refused too. A member sees the director's org pins but can't change them.

**Ownership (D13) with access.** The effective right on an owned scope is the role the structure gives the principal, and only if the run holds that principal tag writable. Reaching `team:self:*` from `org:self` needs `org:self` read/write. The director session has it; members holding `org:self` read-only don't.

## 3a. The store accepts any tag

`canonicalizeKnowledgeScope` (`storage/domains/knowledge/base.ts:685`) stops rejecting anything for its level. Every adapter calls it on reads and writes (LibSQL `knowledge/index.ts:719, 775, 779, 783`; PG/MySQL/Mongo the same), so this one change reaches all of them. The new function:

1. **Checks only shape**: each entry is a non-empty `type:value` with a type matching `^[a-z][a-z0-9_-]*$` (main's `SCOPE_TYPE_PATTERN`, `agent/scopes.ts`). No level names, no one-per-type rule, no ancestor rules.
2. **Dedupes and sorts** by the whole entry, compared by UTF-16 code unit (`a < b ? -1 : a > b ? 1 : 0`), replacing `SCOPE_ORDER` + `localeCompare` (`:680`, `:719`). `localeCompare` depends on the machine's ICU/locale (`['a-b:x','a_b:x','a1:x','ab:x','a:x']` sorts `a_b a-b a: a1 ab` by locale, `a-b a1 a: a_b ab` by code unit), and keys are matched by string equality across ~15 Director processes.
3. **Caps at 8 entries** and throws above. This is a storage-safety limit, not a level rule: visible-scope lookup enumerates every subset (core `knowledgeVisibleScopeKeys` `:733`; LibSQL `visibleScopeKeys` `:139`; PG `:222`; MySQL `:125`; Mongo `:90`). 8 tags = 255 keys in one `IN (...)`. Uncapped, `1 << n` wraps at 32 and builds `IN ()`, a SQL syntax error, and around 25–30 tags the loop hangs. It lives in canonicalize so explicit-scope API calls are covered too (D11 asks whether Tyler accepts this one throw).

**No existing key moves.** Every stored scope holds one `org`, one `resource` and one `thread` entry at most, and code-unit order already puts them `org < resource < thread` (`o` < `r` < `t`), which is what `SCOPE_ORDER` produced. `:uncurated` companions (`resource:x:uncurated`) sort after `resource:x` under both orders (prefix). They're now just a tag of type `resource` with value `x:uncurated` that no run holds: invisible, but rescoping one no longer throws (D9).

The doc comment at `base.ts:207` ("Avoid identity-style addresses such as `org:*`, `resource:*`") stays: with `$param` only, there are no wildcard addresses.

**Visibility is unchanged:** a record is visible to a query scope that contains every one of its tags (`isKnowledgeScopeVisible`, `:728-731`). The read path passes `run tags ∪ named owned scopes` as the query scope, and the 8-entry cap applies to it.

**Adapters.** LibSQL, PG, MySQL and Mongo import `canonicalizeKnowledgeScope`, `knowledgeScopeKey` and `isKnowledgeScopeVisible` from `@mastra/core/storage` at runtime (PG `knowledge/index.ts:46-63`, MySQL `:2-23`, Mongo `:2-18`) and name no levels (Fayth grepped all four), so none needs a code change. The shared contract tests (`stores/_test-utils`) gain the tag cases and run against every adapter.

**Storage version.** No table, column or index change, and existing keys are byte-identical, so schema version and contract version stay 2 (`base.ts:12, 14`). An older core opening a database with new tags can't build a query scope for them, so those rows are invisible to it, and updating one throws. Nothing is rewritten.

**Wave 2 private importers** (`importers.ts:29,167`) do their own org-id validation for org destinations; whether any of them leans on core's ancestor rule is checked at rebase.

**From #28318 this pulls forward** the reader `getRunAgentScopes` and the canonicalize change. Its stored scope nodes, `record_scopes`, stored grants and schema 3 stay in Wave 2, built on the alpha's `access` config and order.

## 3b. Knowledge ships its own usage instructions

**Today.** The rules for using Knowledge exist only inside the Subconscious agents being deleted: curator `DEFAULT_INSTRUCTIONS` (`curate.ts:21`), `PINNED_INSTRUCTIONS` (`curate.ts:54`) and the remind agent's (`remind-agent.ts:15`). The main agent gets none.

**The block.** Whenever Knowledge attaches tools to an agent, it also adds a short instruction block for them, the way Memory adds OM's (`observational-memory.ts:2103`). Each part is included only when its tools are on:

- **Read** (read tools on): search before answering from Knowledge; read the node before relying on it; cite the record you used; say plainly when nothing was found; when records disagree, show both with their dates.
- **Write** (write tools on): one durable fact per record; append to an existing node before creating a new one; record a change as a new dated record rather than rewriting; remove only records that are wrong.
- **Pins** (pin tools on): `PINNED_INSTRUCTIONS` from `curate.ts:54`, reused verbatim. Its first sentence addresses the curator ("Maintain the pin set…"), but it already speaks to whoever holds the pin tools, so it fits the main agent unchanged.

**Where it's injected.** A `KnowledgeInstructionsProcessor` in `core/knowledge`, modelled on `WorkspaceInstructionsProcessor` (`processors/processors/workspace-instructions.ts:77-95`): `processInputStep` calls `messageList.addSystem(...)`. The Agent adds it next to the workspace-instructions processor (assembled at `agent.ts:2450`, returned as `[...memory, ...workspace, ...skills, ...channel, ...browser, ...configured]` at `:2465-2470`), so it lands after the memory processors. Its fixed id is `'knowledge-instructions-processor' as const`, de-duplicated like the workspace one (`workspace-instructions.ts:54`), so an app that configures its own copy isn't doubled.

**Caching.** The block's text is stable: it depends only on which tool groups are on and the app's override, never on run scopes, pins, search results or time. Its position follows the memory processors, so it sits behind OM's system block, which changes when observations activate (not every turn). The block doesn't make the prefix stable by itself; it just never breaks it. The tool schemas, which most providers place before the system prompt, are also stable: the tools' `scope` description lists the run's scope _patterns_, not values, so it's identical for every run holding the same types and differs only between runs with different type sets (for example with and without a thread). Pins stay in their own state-signal lane (section 3), not here.

With the in-run path (section 3) pins are shown in runs without Memory too, so the pin part always matches what the model sees.

**Override API.**

```ts
new Knowledge({
  instructions: false, // no block
  // or a string replacing the whole block,
  // or ({ read, write, pins }) => `${read}\n${write}\nOur extra rule…`   // extend or replace parts
})
company.getInstructions({ write: true, pins: false }) // the block for explicit createTools() wiring
```

The function receives the default text for each enabled part, and `''` for a disabled one. It must return a deterministic string for the cache to hold; the docs say so.

**Search.**

- `KnowledgeSemanticIndexCoordinator` moves into core and runs on the Knowledge's own vector store and embedder. Its index name stays `knowledge_documents_dimension_N`, which can't collide with Memory's `memory_messages`.
- Draining the outbox happens before every search (in bounded batches) and, without blocking, after each tool write.
- **Indexing lag:** records written by anything other than a tool, such as an import or a direct API call, are indexed only when some process next runs a search. A first search after a bulk import is slower.
- Without a vector store, search is keyword-only.
- **The store enqueues outbox rows on every write regardless of a vector store** (e.g. `inmemory.ts:370, 479-486, 505, 557-558`; LibSQL/PG the same). The alpha keeps that: rows stay pending, one per write, and if a vector store and embedder are added later the first search back-fills the index from them. The cost is outbox growth on keyword-only instances, one row per write (the Director dogfood, ~15 writers on one graph, grows with its write count). Pruning is left for later and will live in core Knowledge, next to the moved semantic-index coordinator, as a maintenance call that drops pending rows superseded by a newer row for the same target; the stores already expose `listSemanticOutbox`/claim/complete for it.

**What Memory still adds** when both are set: message history, OM, and a thread that persists pins' state signals, so pins send deltas instead of a snapshot every call. Memory no longer has a `knowledge` option and holds no Knowledge code (D4).

## 4. Limits in tokens

Counted with `estimateTokenCount` from tokenx, which is already a core dependency (`core/package.json:993`). tokenx **estimates**, so the limits are approximate, and the docs will say so.

| Today                                                           | Becomes                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `MAX_KNOWLEDGE_RECORD_TEXT_LENGTH` = 1000 UTF-16 units          | `MAX_KNOWLEDGE_RECORD_TOKENS` = 250                        |
| `MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH` = 400                   | `MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS` = 100              |
| pins `maxCharacters` default 2000, max 8000 (`pinned.ts:21-22`) | `maxTokens` default 500, max 2000 (D1); `maxPins` stays 20 |

- **The old constant names are removed, not kept with a new unit**, with one exception: `MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH` stays exported, unused and `@deprecated`, because published `@mastra/memory` 1.36.0 imports it statically from `@mastra/core/storage` and would fail to load on the new core. `MAX_KNOWLEDGE_RECORD_TEXT_LENGTH` has no published importer and is removed.
- The assert function names stay. The LibSQL, PG and MySQL adapters call them on every write (libsql 718/817/962, pg 954/1052/1197, mysql 309/409/551). LibSQL and PG load them through `loadKnowledgeV2Core()`, so their code needs no change.
- Two test updates: the shared store test contract `stores/_test-utils/src/domains/knowledge/index.ts:5-6, 643-651` (constants and the `UTF-16 code unit limit` message), and the MySQL and Mongo knowledge tests.
- The pin budget (`pinned.ts:~103`) counts the whole pin set, so the token version estimates tokens over the whole set, not per pin.
- The tool schemas drop `maxLength`, because a schema can't count tokens. The check at execute time is the real limit.

## 5. Effect on other work

**Wave 2 stack (#28318–#28323), paused.** The alpha goes off main, as the director decided. Against main, the stack touches 29 of the alpha's files (+2600/−1228). Nearly all of that is in #28318, so the rebase will conflict heavily there. Which side owns what:

| Piece                                                                                                     | Owner after the alpha    | At the Wave 2 rebase                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tools, pins, semantic index                                                                               | Alpha, in core/knowledge | Drop the stack's copies under `subconscious/`                                                                                                                                                                      |
| Instance `tools` flag                                                                                     | Alpha                    | Drop the stack's Memory-side wiring: `getKnowledgeToolsConfig`, `#withoutKnowledgeTools`, memory-root `createKnowledgeTools`                                                                                       |
| Importer-claim guard (remove, rescope, merge)                                                             | Wave 2                   | Port into the moved core `knowledge-write-tools`; the guard in `curate.ts` disappears with Subconscious                                                                                                            |
| Run-scope reader `getRunAgentScopes` and tag-accepting store                                              | Alpha                    | Keep one copy of the reader (Wave 2 has the same function). Wave 2's scope nodes, grants and importer scopes build on the alpha's tags, and its own `canonicalizeKnowledgeScope` changes conflict with the alpha's |
| Scope ownership (`access` on scope types with `$param` patterns, the run-time ownership check)            | Alpha                    | Wave 2's stored grants and scope nodes implement the same `access` config; its own `IDENTITY_SCOPE_PATTERNS`/`BUILT_IN_SCOPE_TYPES` changes conflict with the alpha's removal of `org`                             |
| State-signal in-run path (`stateSignalWithoutMemory`)                                                     | Alpha                    | None                                                                                                                                                                                                               |
| Token limits                                                                                              | Alpha                    | Recheck importers that write long record text against the 250-token limit                                                                                                                                          |
| Factory Knowledge routes (rungs removed, `selectedView` by tag type, subset containment, org-tag refusal) | Alpha                    | Wave 2's Factory routes and UI scope lens rebase onto them                                                                                                                                                         |

**Kayle's Director dogfood plan.** The alpha is meant to carry everything it needs. Each member run passes its tags through `scopes` (`{ tag:'org:self', access:'read' }`, `team:self:<team>`, `agent:<name>`, `request:r25`; only the director session holds `org:self` read/write) and the store accepts them. The director's `org:self` owns the team scopes through the structure and reaches them with the tools' `scope` argument. LibSQL (Tyler's pick) needs no adapter change. Pins work with or without Memory. Kayle is sending a gap list through the director; anything on it not covered here is added before Build it.

## 6. Tests to add

For each, a red control showing the test fails without the change.

**Agent attachment and tools**

- An agent with Knowledge and no Memory gets read tools only by default; keyword-only search without a vector store, semantic with one.
- Write tools stamp `agent:<id>` as the source and refuse without a thread.
- With no vector store, the outbox grows by exactly one row per write.

**Run scopes**

- Tags set in `mastra__scopes` by the caller, without the run's WeakSet mark, are ignored by `getRunAgentScopes`.
- Knowledge adds `resource:` and `thread:` from the run's identity; a run without Memory ids holds only its tags.
- A run with `scopes: ['org:acme', 'team:acme:a']` writes at those tags plus resource and thread by default. A run tagged `team:acme:b` can't see it. A write with `scope: ['org:acme']` is visible to every `org:acme` run.
- Two values of one type (`team:acme:a`, `team:acme:b`) are accepted in one run.
- `scope` naming a tag the run neither holds nor owns is refused, for read and write.
- Mastra Code: a local session reads Knowledge written before the change under `org:local`. For each of the three sources (Agent config, `mastra__scopes`, per-call `scopes`): a local session given `org:self` holds exactly `org:self` and gets its tools, and a Factory session given a different `org:` is refused with an error naming the tag (six cases). A Factory session writes under `org:<org>` + `project:<id>` (stamped by Factory's server, not the SDK) plus its run tags.

**Per-message scopes and off switch**

- `session.sendMessage({ content, scopes: ['request:r1'] })` then `{ scopes: ['request:r2'] }` on one session: each run's writes carry its own request tag, and the conversation continues across both. A message with different scopes sent during an active run starts its own run after that one ends.
- r2 then r3 sent during r1 start in that order.
- A follow-up or notification with no scopes during a scoped run joins it and writes under the run's tags.
- A message with different scopes during an `untilIdle` run waits for the idle end.
- `blocked` with `reason: 'thread-blocked'` still goes through `#waitForOtherAgentRun`; `reason: 'scope-mismatch'` waits on the run's own `runId` (both tested).
- A scoped message to a thread whose same-agent run is owned by another process gets `scope-mismatch` and starts its own run after that run ends; a scope-less one still joins it. A scoped message to a thread held by another agent (`remoteCrossAgent`) still gets `thread-blocked`.
- A remote message with a tag type the host doesn't allow is refused.
- The mismatch decision is atomic: a run ending at the same moment as the send never lets the message join a run with other scopes.
- No instance and no flag: no Knowledge tools, pins or instructions. `knowledge: false` with the flag set: the same.

**Many processes**

- 4 processes on one LibSQL file, 50 writes each, concurrent startup reconcile: 200 records, one structure, no errors.
- A lock held past the timeout: the other process's write fails with `SQLITE_BUSY`, no hang, no corruption.
- A store built from an injected `{ client }` is flagged by the test as having no busy timeout; the Director builds from the URL.

**Session defaults**

- A run with no caller tags gets `org:local`. A member run with only `team:self:x` (+ agent) gets no `org:` tag, and its write at `scope: ['team:self:x']` is visible to the director via ownership; its default (private) write is not.

**Read-only scopes** (§3c)

- A record at `[org:self]` is visible to a run holding `{ tag:'org:self', access:'read' }`, so a read-only tag hides nothing.
- That run's default write lands at its writable tags only, without `org:self`.
- A `scope` argument naming `org:self` on `knowledge_create`/`append`/`remove`/`rescope`/`merge_nodes`/`pin` is refused with the tag named; on `knowledge_search`/`read` it's accepted.
- Union narrowing, one test per source pair in both directions (read-only in one, readwrite in the other): agent config × per-call, agent config × request context, per-call × request context, session `defaultScopes`/`requiredScopes` × per-call. Each ends read-only; a model `scope` arg can't widen it; a resume can't widen it.
- A forged `mastra__scopes` without a marked access map gives no tags; a marked access map stays read after JSON round-trip and durable resume.
- `resource:`/`thread:` as object entries are refused.
- A record written by a run holding `{org:self,read}` + `team:self:x` has the same stored scope key as one written by a run holding plain `team:self:x`; 8 distinct tags with some read-only pass, 9 fail.
- Director shape: a member `[{org:self,read}, team:self:director, agent:alex]` writes at team/agent, sees org records and director org pins, and can't reach `team:self:other` (a read-only owner tag owns nothing, for reads or writes). The director session `[org:self, team:self:director]` sees members' team writes through ownership and writes org-wide. Pins at `org:self` can't be edited by the member.
- A message with the same tags but different access during an active run gets `scope-mismatch`.

**Structure and ownership**

- A run tag or `scope` value with a `$`-leading segment (`team:$org:director`, `team:acme:$x-y`) is refused at canonicalize and by the tools' `scope` validator.
- An undeclared type (`request:r25`, no structure entry) can be read and written by a run holding it, and can't be named through ownership.
- No `org` is built in: a structure without `org:` types still accepts `org:x` tags (as `custom`), and `materializeKnowledgeScopePlan` accepts an `org:` child template.
- Ownership: with `'team:$orgId:$teamId'` owned by `org:$orgId`, a run holding `org:acme` reads and writes `team:acme:director` through `scope`, and is refused `team:other:director`. With `'project:$orgId:$projectId'` owned by `org:$orgId` at role `edit`, a run holding `org:acme` can rescope a `project:acme:p` record; with role `readonly` it can read but its write is refused.
- Ownership on LibSQL and PG, not only InMemory.
- A run tag or named scope with `$x` as a segment is refused; `team:acme:director` is not owned by a run holding `org:acme2`.
- A principal using a `$param` missing from its type pattern fails at `new Knowledge(...)`, not at the first read.
- `self`/`parent` principals grant nothing at call time.
- Run tags plus named scopes over 8 return a tool error naming the cap.

**Store** (shared contract, so InMemory, LibSQL, PG, MySQL, Mongo)

- `canonicalizeKnowledgeScope` accepts any well-shaped `type:value`; it rejects only a malformed entry and more than 8 entries, called directly and through each adapter's read and write.
- Keys sort by whole entry by code unit, independent of locale: `['a:x','ab:x','a_b:x','a1:x','a-b:x']` canonicalizes to exactly `a-b:x a1:x a:x a_b:x ab:x`.
- Scope keys already written for `org`/`resource`/`thread` (and `:uncurated` companions) are byte-identical before and after.
- A `thread` tag without `resource`, and a `resource` without `org`, are accepted.
- Limit checks run at the new token bounds.

**Pins**

- With Memory: a snapshot, then deltas, nothing when unchanged. One user's pin shows in their other threads and never in another user's.
- Without Memory: pin tools are present, and every call's first step gets the same snapshot for the same pins, with and without `threadId`/`resourceId`. The task, goal and browser state-signal providers still throw without Memory.
- Without Memory, multi-step: a pin tool changes a pin in step 1; step 2 gets a delta, not a second snapshot.
- Without Memory, replay: replaying `response.messages` gives a delta on the next call; not replaying gives a snapshot.
- Pin limits are enforced in tokens.

**Factory**

- A record at `[org:x, project:p]` is reported with its tags, not as `org`, and is shown in a view `[org:x, resource:r, thread:t, project:p]`; `selectedView` on a view with `project:` and no `org:` picks by type. A Factory-called read or write with no `org:` tag is refused. A Factory session given a differing `project:` is refused; a write in project A is not visible in project B. A Factory run's tools have no `scope` argument, and naming another project's scope through the explicit API is refused. `scopeKindLabel` labels by tag type, and `#vouchIdentityScopes` vouches exactly the run's org/project/resource/thread.

**Leftovers and instructions**

- A repo-wide `git grep -n "org:\|organizationId"` on the alpha tip is attached to the PR, each remaining hit explained (Factory auth/session plumbing, tests, docs).
- OM still strips old Subconscious signals from observer input, and `deleteThread` still removes owned remind threads.
- A Mastra Code agent still has its knowledge tools and pins after the SDK rewire. The TUI renders an old thread containing `subconscious-activity` signals without printing them.
- Instructions: read tools only → read part only; write adds the write part; pins add `PINNED_INSTRUCTIONS`, byte-equal to `curate.ts:54`. The block is byte-identical across two turns with different scopes and pin changes. `instructions: false` removes it, a string replaces it, a function extends it. An app-configured processor with the same id isn't doubled.

## Open decisions

| #   | Decision                                                                                                                                                   | My pick                                                                                                                                                                                                                                                                                                                                                                                         | Alternative                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Name of the token-limit options                                                                                                                            | `maxTokens` (matches `messageTokens`/`observationTokens` in OM)                                                                                                                                                                                                                                                                                                                                 | `tokenCount`, from Tyler's comment                                                                                                                                                                                                                                                      |
| D2  | Defaults when an agent has `knowledge`                                                                                                                     | read on, write off, pins off; instructions follow the tools that are on                                                                                                                                                                                                                                                                                                                         | everything off until set                                                                                                                                                                                                                                                                |
| D3  | ~~No `organizationId`~~                                                                                                                                    | removed: `organizationId` is gone, an org is an `org:` tag                                                                                                                                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                         |
| D4  | Memory's `knowledge` option                                                                                                                                | remove it; attach to the agent                                                                                                                                                                                                                                                                                                                                                                  | keep it as a shortcut                                                                                                                                                                                                                                                                   |
| D5  | Mastra Code switch                                                                                                                                         | rename `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` (`sdk/agents/memory.ts:~250`) to `MASTRACODE_EXPERIMENTAL_KNOWLEDGE=1`. It attaches a default Knowledge with read, write and pins on, tagged `org:local` (or the Factory org; no project tag), and no longer requires a vector store (without one, search is keyword-only). `createMastraCode({ knowledge: { instance, scopes } })` needs no flag | keep the old flag name                                                                                                                                                                                                                                                                  |
| D6  | Release note                                                                                                                                               | Tyler's fixed wording, "Changes to an experimental, upcoming memory feature.", plus one line: "`experimental_subconscious` is removed; attach Knowledge to the agent instead."                                                                                                                                                                                                                  | wording only, no removal line                                                                                                                                                                                                                                                           |
| D7  | Pins without Memory                                                                                                                                        | settled by Tyler: the pins provider moves to core and pins work without Memory, through an opt-in in-run state-signal path (snapshot every call)                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                         |
| D9  | Rows written only with the experimental Subconscious flag on: Factory Knowledge under `resource:<projectId>`, and rows with `:uncurated` companion entries | accept that they go out of view                                                                                                                                                                                                                                                                                                                                                                 | migrate them: rewrite `resource:<projectId>` → `project:<projectId>` (keeps project isolation under D14 (a)) and strip `:uncurated` entries. Under D14 (b) the only migration is stripping `resource:<projectId>`, which makes project-private rows visible to every project in the org |
| D10 | Who fills the tools' `scope` argument                                                                                                                      | **settled by Tyler:** the harness supplies the run's access, the model picks a scope within it; an app can fix it with `createTools({ scope })`                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                       |
| D15 | Read/write access on scopes                                                                                                                                | **settled by Tyler:** an entry is a string (read and write) or `{ tag, access: 'read' }`. No write-only. The narrowest harness source wins and the model never widens. A read-only tag is never an ownership principal (§3c)                                                                                                                                                                    | —                                                                                                                                                                                                                                                                                       |
| D13 | How "org owns team scopes" is held                                                                                                                         | **settled by Tyler:** computed at call time from the structure's `access`; nothing stored, works on every adapter. When Wave 2's stored grants land they are unioned with this check (config stays the single source for type-level rules)                                                                                                                                                      | —                                                                                                                                                                                                                                                                                       |
| D14 | Project isolation in Factory                                                                                                                               | (a) Factory declares `project:$projectId` and stamps `project:<id>` as a required tag on its sessions; routes read `project:` instead of `resource:<projectId>`; isolation unchanged from today                                                                                                                                                                                                 | (b) no project isolation: every project in an org reads the same org-level Knowledge, a visibility change from today that needs Tyler's explicit yes                                                                                                                                    |
| D12 | Tags whose type the structure doesn't declare                                                                                                              | allowed (main's `custom` fallback); only ownership needs a declaration                                                                                                                                                                                                                                                                                                                          | strict: refuse undeclared types, so every scope type is in the structure                                                                                                                                                                                                                |
| D11 | The 8-tag throw in `canonicalizeKnowledgeScope`                                                                                                            | keep it: a storage-safety cap, not a level rule (uncapped lookups build `IN ()` or hang)                                                                                                                                                                                                                                                                                                        | move the cap to the Knowledge layer only, leaving explicit-scope API calls unguarded                                                                                                                                                                                                    |
| D8  | Leftovers in existing threads                                                                                                                              | keep three small protections: OM strip of old signals, `deleteThread` remind cleanup, TUI skips old activity signals                                                                                                                                                                                                                                                                            | drop them and accept raw signals or orphaned remind threads in old threads                                                                                                                                                                                                              |

Build it means: build on branch `feat/knowledge-alpha-standalone` off main `b1244bd3bc0` with my pick on each decision, pushing as I go. I open a draft PR once real code commits exist. Fayth reviews; no merge and no reviewer requests.
