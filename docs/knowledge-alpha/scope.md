# Knowledge alpha scope, v6 (report 20261023T223907)

Everything here was checked against main `b1244bd3bc0`. v5 follows Tyler's three comments (thread ans-2026-10-23T22:58:30.509Z):
- Knowledge reads the run's tagged scopes, including the `scopes` key agent methods already take.
- `organizationId` and `knowledgeResourceId` are deleted.
- Pins stay a prompt-cacheable state signal.

v6 adds two things:
- Knowledge's own usage instructions, Tyler's decision (section 3b).
- The store-widening details Fayth asked for (section 3a).

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

Move `knowledge-tools`, `knowledge-write-tools`, `pinned`, `pinned-state-processor` (still a state-signal processor, section 3) and `semantic-index`. Delete `scope.ts`, the `knowledgeResourceId` reader. All five import only `@mastra/core/*` and `json-schema`, so core needs no new dependencies. It belongs in core and not a new package because `Agent` has to attach it, and the storage contract already lives there.

## 2b. The API

```ts
const company = new Knowledge({
  id: 'company', storage,
  vector, embedder,                      // optional; without them search is keyword-only
  tools: { read: true, write: false },   // what an attached agent gets
  pins: { maxPins: 20, maxTokens: 500 }, // or true / false
});
new Agent({ knowledge: company /* or a registered key */ });
const tools = company.createTools({ write: true }); // explicit wiring
```

- `tools`, `pins`, `vector` and `embedder` are **all new options on `KnowledgeConfig`** (main has id, name, description, structure, `scopes?: KnowledgeScopeTypesConfig` and storage; `core/knowledge/config.ts`). `vector` and `embedder` exist only on Memory today.
- Tools merge next to `workspaceTools` in `agent.ts:7369-7379`.
- An agent with Knowledge and no Memory gets no "no memory configured" warning (`agent.ts:8760`).

## 3. Scopes, Memory and pins

**Knowledge reads the run's tagged scopes, and nothing else.**
- On main, agent methods already take `scopes: string[]` (`agent.types.ts:467-472` for generate/stream, `:620-625`), Agents take `scopes` (`types.ts:838-841`), and `mastra__scopes` carries them in the request context. `resolveAgentScopes` (`agent/scopes.ts:201`) unions the three. Each tag is `<type>:<value>`, e.g. `org:acme`, `team:director`, `request:r25`.
- `setRunAgentScopes` (`scopes.ts:59`, from #26593) writes the run's non-identity tags onto the run's copy of the request context under `MASTRA_SCOPES_KEY` (`mastra__scopes`), via `deriveAgentRunRequestContext` (`:286`). The array object goes into a WeakSet (`runScopeValues`, `:51-56`). `restoreRunAgentScopes` (`:68`) re-marks it after a durable resume.
- **How tools read them:** a new reader, `getRunAgentScopes(requestContext)`, about 10 lines in `agent/scopes.ts`. It reads `requestContext.get(MASTRA_SCOPES_KEY)` and returns the tags only if that exact array is in the WeakSet; otherwise it returns `[]`. So only Core-marked values are trusted: a caller that writes `mastra__scopes` into its own request context, or one that arrives as JSON in a request body, gets nothing. Tools and the pins processor call it on every execution. Wave 2 has the same function (section 5).
- **A run's Knowledge scope** = those tags, plus `resource:<resourceId>` and `thread:<threadId>` from the run's identity when it has them. Tools and the pins processor compute it per call from trusted context; the model never supplies a scope.
- **`organizationId` and `knowledgeResourceId` are deleted** as Knowledge inputs: the request-context keys, the SDK stamping (`sdk/agents/memory.ts:306-319`), `subconscious/scope.ts`, and the overrides v4 proposed for `createMastraCode`. An org is just an `org:` tag. D3 (refuse without an org) goes away: a run without an `org:` tag simply holds fewer tags.

## 3a. Widening the store to accept any tag

On main, `canonicalizeKnowledgeScope` (`storage/domains/knowledge/base.ts:685`) throws `Invalid knowledge scope entry` (`:693`) for any level except `org|resource|thread`. Every adapter calls it on reads as well as writes (e.g. LibSQL `knowledge/index.ts:719, 775, 779, 783`; MySQL and Mongo the same), so the alpha has to widen it. The rules:

1. **One entry per level, kept** (`:697-700`). A run can't hold `team:a` and `team:b` at once. Two values of one type would make "which one does a write land at" ambiguous, and `resolveAgentScopes` doesn't dedupe by type, so the reader refuses such a run.
2. **New tags don't join the ancestor chain** (`:706-711`). Tags are independent of each other. One rule stays: `thread` requires `resource`, because Memory always sets both. "`resource` requires `org`" goes, so a plain agent without an `org:` tag can still use Knowledge.
3. **A fixed order, so stored keys never move.** The scope key is the sorted entries joined (`knowledgeScopeKey`, `:724`), so the sort has to be a total order that never changes:

   | Position | Levels |
   |---|---|
   | 0, 1, 2 | `org`, `resource`, `thread` (unchanged, `SCOPE_ORDER` `:680`) |
   | then | every other entry, compared as the whole `type:value` string by UTF-16 code unit (not `localeCompare`, which depends on locale) |

   Code-unit order and `localeCompare` disagree for the characters the type pattern allows (`^[a-z][a-z0-9_-]*$`): `['a-b:x','a_b:x','a1:x','ab:x','a:x']` sorts `a_b a-b a: a1 ab` by `localeCompare` and `a-b a1 a: a_b ab` by code unit. Keys are matched by string equality, so two processes with different ICU or locale data (the Director dogfood runs ~15) would compute different keys for one scope. The comparator is `a < b ? -1 : a > b ? 1 : 0`.

   The comparison is on the whole entry, not name then value: `a-b:x` sorts before `a:x` because `-` (45) is below `:` (58). It needs no parsing, and the test asserts exactly `a-b:x a1:x a:x a_b:x ab:x`.

   No existing key changes: every stored scope holds only `org`/`resource`/`thread` entries, whose order is unchanged. Ties only arise between entries of one old level, and the only such pairs are `:uncurated` companions (`resource:x`, `resource:x:uncurated`), where one is a prefix of the other, so either comparison puts the shorter first. Those rows fail the one-per-level rule anyway (item 6, D9). A new level can't move a key either. Its position comes from its own entry, so a key containing only older levels is unaffected, and a key containing it is new. Today's `localeCompare` (`:719`) is replaced by plain code-unit comparison so keys can't differ between machines.
4. **Subset containment narrows** (`isKnowledgeScopeVisible`, `:728-731`). A record is visible only to runs holding every one of its tags, so every extra tag narrows who can read it. That's the intended model:
   - A record at `org:acme` + `team:director` is visible to every run holding both, whatever else it holds.
   - A record that also carries `request:r25` is visible only to runs tagged `request:r25`.
   - Writes default to every tag the run holds, which is the most private placement. Sharing wider means dropping tags (section 3).
5. **Limit: 8 tags, enforced in `canonicalizeKnowledgeScope`.** Visible-scope lookup enumerates every subset of the scope (core `knowledgeVisibleScopeKeys`, `:733`; LibSQL `visibleScopeKeys`, `:139`; PG `:222`, MySQL `:125`, and Mongo `:90` doubles a powerset). So 8 tags means 255 keys in one `IN (...)`, which is fine. Without a cap it breaks badly: the adapters loop `mask < 1 << n`, which wraps at 32, so 31 or more tags build an empty list and `scopeKey IN ()` is a SQL syntax error. Around 25 to 30 tags the loop runs tens of millions to a billion times and hangs the process. Any caller passing an explicit `scope` to the public API reaches this without going through the run reader. So the cap lives in core's `canonicalizeKnowledgeScope`, which every adapter and InMemory call first: more than 8 entries throws. The run reader also refuses such a run, so the agent gets no Knowledge tools or pins and the error says why.
6. The `:uncurated` companion entries (`:690-692`) were Subconscious-only, so their handling goes. Today canonicalize skips them for the level check but keeps them in the entries and the key. Under the new rules `resource:x:uncurated` is a second `resource` entry, so a scope holding both is refused. Rows written that way become invisible, and rescoping one throws. They are the same population as D9 (rows written only with the experimental Subconscious flag on), and D9 decides them too. `expandKnowledgeScope(context, level)` (`:748`) and `KnowledgeScopeLevel` (`:6`) are replaced by a tag subset ("keep these levels"). Their callers are all in the moved tool files.

**Adapters.** LibSQL, PG, MySQL and Mongo import `canonicalizeKnowledgeScope`, `knowledgeScopeKey` and `isKnowledgeScopeVisible` from `@mastra/core/storage` at runtime (PG `knowledge/index.ts:46-63`, MySQL `:2-23`, Mongo `:2-18`). None of them name a level, so none needs a code change. Each stores the scope as JSON plus its key string, and both just carry the new tags. Clickhouse and Turso have no Knowledge domain. The shared store contract tests (`stores/_test-utils`) gain the tag cases, which runs them against every adapter.

**Storage version.**
- **No schema change:** no table, column or index changes, and every existing key is byte-identical, so `KNOWLEDGE_STORAGE_SCHEMA_VERSION` stays 2 (`base.ts:14`).
- **The contract version (`:12`) stays 2:** adapters report it from core, and the rule lives in core, so an adapter can't support tags while its core doesn't.
- **Mixed versions fail closed.** A database with tagged rows opened by an older core can't build a query scope that includes them, so those rows are just invisible to it. Updating one through the older core throws `Invalid knowledge scope entry`. Nothing is lost or rewritten. The feature is experimental, so that's acceptable.

**How much of #28318 this pulls forward.** Only two pieces:
- the reader `getRunAgentScopes`, which is identical to #28318's;
- a one-function change to `canonicalizeKnowledgeScope`.

#28318's scope model stays in Wave 2:
- addressable scope nodes, `scopes`/`node_scopes`;
- grants and roles (readonly/append/edit/owner);
- `record_scopes`, `memoryScopeTypes` and parent patterns;
- storage schema 3 (`619868abb10`).

At the rebase, #28318's `canonicalizeKnowledgeScope` conflicts with the alpha's and must keep the alpha's order table, so keys written under the alpha stay valid.

**Where writes land.**
- A write lands at every tag the run holds by default, which is the most private placement. The model can name a subset of the run's tag types to share wider (e.g. drop `thread` and `resource` to write at `org` + `team`). It can't add a tag or write with none.
- Agent tools are resolved per run, so each tool schema's enum of tag types is built from that run's tags. That also fixes the per-run baking in today's write tools (`knowledge-write-tools.ts:12-20`).
- Pins default to every tag except `thread`, so a pin follows the user across threads. That matches today's resource-level pins when a run holds org, resource and thread.

**Tenant isolation without the ancestor rule.** The rule "`resource` requires `org`" was the storage-level backstop for tenant isolation. Without it, a record scoped only `[team:director]` is visible to any run holding `team:director`, in any org. The guard is that every multi-tenant caller stamps an org tag. So where Factory is the caller, its Knowledge routes and the explicit-scope API refuse a scope without an `org:` tag, with a test. Single-tenant apps (a plain `new Agent({ knowledge })`) may leave the org out.

**Factory routes read the scope array, so they change too.** `mastracode/factory/src/routes/knowledge.ts`:
- `deepestRung` (`:316-325`) returns `org` for any scope without `resource`/`thread`, so a record at `[org:x, project:p]` would be reported as org-level in the UI payload.
- `view.scope.slice(0, 1)` and `slice(0, 2)` (`:636-640`) assume the org comes first and the resource second, which no longer holds for a scope without an org tag.
- `withinViewBoundary` (`:327-334`) tests an index-by-index prefix of the canonical array. `project:` sorts after `thread`, so `[org:x, project:p]` is not a prefix of the view `[org:x, resource:r, thread:t, project:p]` even though subset containment makes it visible. Sibling-project filtering in the member lens would hide content it should show.
- All three are rewritten to subset containment, with a Factory route test that uses a project tag.

**What Mastra Code passes.** The API is `createMastraCode({ knowledge: { instance, scopes? } })`. The `key` goes away with Memory's `knowledge` option (D4), and so do v4's `organizationId`/`resourceId` overrides.
- The SDK sets the agent's `scopes` to the caller's `scopes` plus the session's own tags. A session tag is a default: it is added only when the caller supplies no tag of that type, so a run never ends up with two entries of one type through the SDK.
- Local TUI/studio sessions add `org:local` when the caller passes no `org:` tag, so existing local Knowledge stays visible. A caller passing `org:self` gets exactly `org:self`.
- Factory sessions add `org:<factoryOrg>` and `project:<projectId>`. Here a caller-supplied `org:` or `project:` tag that differs from the session's is refused rather than taking precedence, because it would cross tenants. The project used to sit in the resource slot through `knowledgeResourceId`. A `resource:` tag must equal the Memory resource (`resolveAgentScopes` throws otherwise), so the project becomes its own tag.
- Factory Knowledge already written under `resource:<projectId>` will no longer be visible. It was only written with the experimental Subconscious flag on (D9).
- A Factory session whose org can't be resolved still gets no Knowledge, as today.
- The Director dogfood passes `scopes: ['team:director', 'agent:<name>', 'request:r25', …]`. Per-request scopes therefore work in the alpha, without Wave 2.
- Writes default to every tag the run holds. A session mixing its own tags with agents tagged differently (a director session and its members) must have the model name a subset to share, e.g. `['org:self', 'team:director']`; the default write is private to runs holding all the writer's tags. The instructions' write part says so.

**Pins stay a state signal, so pins need Memory.**
- The pins processor stays `PinnedStateProcessor` on the state-signal lane: a snapshot first, then deltas, and nothing when the pins are unchanged. That keeps the prompt cacheable, as it is today. v4's system-prompt block is gone.
- The lane persists signals in the thread through Memory. `ProcessorRunner` throws without Memory (`processors/runner.ts:496`) and loads the thread from it.
- So **pins are on only when the agent has both a Knowledge with `pins` and a Memory.** The Agent, not Memory, adds the processor, de-duplicated by its state id.
- An agent with Knowledge and no Memory gets read/write tools but no pin tools and no pins processor, and logs one warning if `pins` is set. Pin tools never show up where nothing could read the pins back.
- Pins also need a resourceId and threadId, as on main (`runner.ts:503-510` skips without them).
- **Running the lane without Memory** would need a different store for signals and their tracking. Today the runner loads the thread (`getThreadById`), reads signal history (`resolveStateSignalHistory`, `agent/state-signals.ts:149`), and persists each signal plus `lastSnapshotSignalId` in the thread's metadata, all through Memory. Making that store pluggable changes the core processor API and gets its own PR. **For the alpha, pins require Memory.**

**Tools without Memory.** `agent.ts:8731-8745` resolves the thread and resource from call options and the reserved request-context ids, and the tool builder passes them through (`tool-builder/builder.ts:637-644, 739-740`). Write tools need a thread, as on main. Their records come from runs with no Memory history, which is fine.

## 3b. Knowledge ships its own usage instructions

**Today.** The rules for using Knowledge exist only inside the Subconscious agents being deleted: curator `DEFAULT_INSTRUCTIONS` (`curate.ts:21`), `PINNED_INSTRUCTIONS` (`curate.ts:54`) and the remind agent's (`remind-agent.ts:15`). The main agent gets none.

**The block.** Whenever Knowledge attaches tools to an agent, it also adds a short instruction block for them, the way Memory adds OM's (`observational-memory.ts:2103`). Each part is included only when its tools are on:
- **Read** (read tools on): search before answering from Knowledge; read the node before relying on it; cite the record you used; say plainly when nothing was found; when records disagree, show both with their dates.
- **Write** (write tools on): one durable fact per record; append to an existing node before creating a new one; record a change as a new dated record rather than rewriting; remove only records that are wrong.
- **Pins** (pin tools on): `PINNED_INSTRUCTIONS` from `curate.ts:54`, reused verbatim. Its first sentence addresses the curator ("Maintain the pin set…"), but it already speaks to whoever holds the pin tools, so it fits the main agent unchanged.

**Where it's injected.** A `KnowledgeInstructionsProcessor` in `core/knowledge`, modelled on `WorkspaceInstructionsProcessor` (`processors/processors/workspace-instructions.ts:77-95`): `processInputStep` calls `messageList.addSystem(...)`. The Agent adds it next to the workspace-instructions processor (assembled at `agent.ts:2450`, returned as `[...memory, ...workspace, ...skills, ...channel, ...browser, ...configured]` at `:2465-2470`), so it lands after the memory processors. Its fixed id is `'knowledge-instructions-processor' as const`, de-duplicated like the workspace one (`workspace-instructions.ts:54`), so an app that configures its own copy isn't doubled.

**Caching.** The block's text is stable: it depends only on which tool groups are on and the app's override, never on run scopes, pins, search results or time. Its position follows the memory processors, so it sits behind OM's system block, which changes when observations activate (not every turn). The block doesn't make the prefix stable by itself; it just never breaks it. The tool schemas, which most providers place before the system prompt, are also stable: the write tools' scope enum lists the run's tag *types*, not values, so it's identical for every run holding the same types and differs only between runs with different type sets (for example with and without a thread). Pins stay in their own state-signal lane (section 3), not here.

The pin part is included whenever pin tools exist, but the pins processor skips runs without a resource or thread id (`runner.ts:503-510`). In such a run the block describes pins while none are shown. That's harmless and accepted.

**Override API.**
```ts
new Knowledge({
  instructions: false,                                             // no block
  // or a string replacing the whole block,
  // or ({ read, write, pins }) => `${read}\n${write}\nOur extra rule…`   // extend or replace parts
});
company.getInstructions({ write: true, pins: false }); // the block for explicit createTools() wiring
```
The function receives the default text for each enabled part, and `''` for a disabled one. It must return a deterministic string for the cache to hold; the docs say so.

**Search.**
- `KnowledgeSemanticIndexCoordinator` moves into core and runs on the Knowledge's own vector store and embedder. Its index name stays `knowledge_documents_dimension_N`, which can't collide with Memory's `memory_messages`.
- Draining the outbox happens before every search (in bounded batches) and, without blocking, after each tool write.
- **Indexing lag:** records written by anything other than a tool, such as an import or a direct API call, are indexed only when some process next runs a search. A first search after a bulk import is slower.
- Without a vector store, search is keyword-only.
- **The store enqueues outbox rows on every write regardless of a vector store** (e.g. `inmemory.ts:370, 479-486, 505, 557-558`; LibSQL/PG the same). The alpha keeps that: rows stay pending, one per write, and if a vector store and embedder are added later the first search back-fills the index from them. The cost is outbox growth on keyword-only instances, one row per write (the Director dogfood, ~15 writers on one graph, grows with its write count). Pruning is left for later and will live in core Knowledge, next to the moved semantic-index coordinator, as a maintenance call that drops pending rows superseded by a newer row for the same target; the stores already expose `listSemanticOutbox`/claim/complete for it.

**What Memory still adds** when both are set: message history, OM, and the thread that pins' state signals live in. Memory no longer has a `knowledge` option (D4).

## 4. Limits in tokens

Counted with `estimateTokenCount` from tokenx, which is already a core dependency (`core/package.json:993`). tokenx **estimates**, so the limits are approximate, and the docs will say so.

| Today | Becomes |
|---|---|
| `MAX_KNOWLEDGE_RECORD_TEXT_LENGTH` = 1000 UTF-16 units | `MAX_KNOWLEDGE_RECORD_TOKENS` = 250 |
| `MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH` = 400 | `MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS` = 100 |
| pins `maxCharacters` default 2000, max 8000 (`pinned.ts:21-22`) | `maxTokens` default 500, max 2000 (D1); `maxPins` stays 20 |

- **The old constant names are removed, not kept with a new unit.** I'm not adding deprecated aliases either: the feature is experimental, and we don't keep compatibility aliases.
- The assert function names stay. The LibSQL, PG and MySQL adapters call them on every write (libsql 718/817/962, pg 954/1052/1197, mysql 309/409/551). LibSQL and PG load them through `loadKnowledgeV2Core()`, so their code needs no change.
- Two test updates: the shared store test contract `stores/_test-utils/src/domains/knowledge/index.ts:5-6, 643-651` (constants and the `UTF-16 code unit limit` message), and the MySQL and Mongo knowledge tests.
- The pin budget (`pinned.ts:~103`) counts the whole pin set, so the token version estimates tokens over the whole set, not per pin.
- The tool schemas drop `maxLength`, because a schema can't count tokens. The check at execute time is the real limit.

## 5. Effect on other work

**Wave 2 stack (#28318–#28323), paused.** The alpha goes off main, as the director decided. Against main, the stack touches 29 of the alpha's files (+2600/−1228). Nearly all of that is in #28318, so the rebase will conflict heavily there. Which side owns what:

| Piece | Owner after the alpha | At the Wave 2 rebase |
|---|---|---|
| Tools, pins, semantic index | Alpha, in core/knowledge | Drop the stack's copies under `subconscious/` |
| Instance `tools` flag | Alpha | Drop the stack's Memory-side wiring: `getKnowledgeToolsConfig`, `#withoutKnowledgeTools`, memory-root `createKnowledgeTools` |
| Importer-claim guard (remove, rescope, merge) | Wave 2 | Port into the moved core `knowledge-write-tools`; the guard in `curate.ts` disappears with Subconscious |
| Run-scope reader `getRunAgentScopes` and tag-accepting store | Alpha | Keep one copy of the reader (Wave 2 has the same function). Wave 2's scope nodes, grants and importer scopes build on the alpha's tags, and its own `canonicalizeKnowledgeScope` changes conflict with the alpha's |
| Token limits | Alpha | Recheck importers that write long record text against the 250-token limit |
| Factory Knowledge routes (`deepestRung`, `withinViewBoundary`, org-tag refusal) | Alpha | Wave 2's Factory routes and UI scope lens rebase onto subset containment |

**Kayle's Director dogfood plan.** It works on the alpha as-is. Each run passes its tags through `scopes` (`org:…`, `team:director`, `agent:<name>`, `request:r25`), and the store accepts them. Nothing is stamped through `organizationId` or `knowledgeResourceId`. Pins need Memory, which Director sessions already have.

## 6. Tests to add

- An agent with Knowledge and no Memory gets read tools only, by default. Its search is keyword-only without a vector store, and semantic with one.
- Write tools stamp `agent:<id>` as the source, and refuse without a thread.
- With no vector store, the outbox grows by exactly one row per write.
- Tagged scopes: a run with `scopes: ['org:acme', 'team:a']` writes at those tags plus its resource and thread. A run tagged `team:b` can't see it. A run tagged `org:acme` only sees what was written with the `team` tag dropped.
- Tags set in `mastra__scopes` by the caller, without the run's WeakSet mark, are ignored by `getRunAgentScopes`.
- The store accepts `request:r25`-style tags on InMemory, LibSQL and PG. Scope keys already written for `org`/`resource`/`thread` are byte-identical before and after. A run with 9 tags is refused.
- Mastra Code: a local session reads Knowledge it wrote before the change under `org:local`. A local session passed `scopes: ['org:self', …]` holds exactly one `org` entry (`org:self`) and gets its tools. A Factory session passed a different `org:` or `project:` is refused. A Factory session writes under `org:<org>` + `project:<id>`.
- Pins: with Knowledge `pins` and Memory, the state signal sends a snapshot, then deltas, and nothing when unchanged. One user's pin shows in their other threads and never in another user's. Without Memory, no pin tools and no processor. Pin limits are enforced in tokens.
- Limit checks run at the new token bounds in the shared store contract (InMemory, LibSQL, PG).
- OM still strips old Subconscious signals from observer input, and `deleteThread` still removes owned remind threads.
- A Mastra Code agent still has its knowledge tools and pins after the SDK rewire.
- The TUI renders an old thread containing `subconscious-activity` signals without printing them.
- Instructions: an agent with read tools only gets the read part and no write or pin parts. With write tools it also gets the write part. With pins it also gets `PINNED_INSTRUCTIONS`, byte-equal to `curate.ts:54`. The block is byte-identical across two turns with different scopes and pin changes. `instructions: false` removes it, a string replaces it, and a function extends it. An app-configured processor with the same id isn't doubled.
- Store: new-level keys sort by whole entry by code unit, independent of locale: `['a:x','ab:x','a_b:x','a1:x','a-b:x']` canonicalizes to exactly `a-b:x a1:x a:x a_b:x ab:x`. Two values of one level are refused. A `thread` tag without `resource` is refused, and one without `org` is accepted.
- Store boundary: `canonicalizeKnowledgeScope` with 9 entries throws, called directly and through each adapter's read and write, not only through a run.
- Factory routes: a record at `[org:x, project:p]` is reported at its own rung, not `org`, and is shown in a view `[org:x, resource:r, thread:t, project:p]`. A Factory-called write or read with no `org:` tag is refused.
- For each, a red control showing the test fails without the change.

## Open decisions

| # | Decision | My pick | Alternative |
|---|---|---|---|
| D1 | Name of the token-limit options | `maxTokens` (matches `messageTokens`/`observationTokens` in OM) | `tokenCount`, from Tyler's comment |
| D2 | Defaults when an agent has `knowledge` | read on, write off, pins off; instructions follow the tools that are on | everything off until set |
| D3 | ~~No `organizationId`~~ | removed: `organizationId` is gone, an org is an `org:` tag | |
| D4 | Memory's `knowledge` option | remove it; attach to the agent | keep it as a shortcut |
| D5 | Mastra Code switch | rename `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` (`sdk/agents/memory.ts:~250`) to `MASTRACODE_EXPERIMENTAL_KNOWLEDGE=1`. It attaches a default Knowledge with read, write and pins on, tagged `org:local` (or the Factory org and project), and no longer requires a vector store (without one, search is keyword-only). `createMastraCode({ knowledge: { instance, scopes } })` needs no flag | keep the old flag name |
| D6 | Release note | Tyler's fixed wording, "Changes to an experimental, upcoming memory feature.", plus one line: "`experimental_subconscious` is removed; attach Knowledge to the agent instead." | wording only, no removal line |
| D7 | Pins without Memory | settled by Tyler: pins stay a state signal, so they need Memory; a Knowledge-only agent gets no pins | |
| D9 | Rows written only with the experimental Subconscious flag on: Factory Knowledge under `resource:<projectId>`, and rows with `:uncurated` companion entries | accept that they go out of view (rescoping one throws) | migrate them: `resource:<projectId>` → `project:<id>`, strip `:uncurated` entries |
| D8 | Leftovers in existing threads | keep three small protections: OM strip of old signals, `deleteThread` remind cleanup, TUI skips old activity signals | drop them and accept raw signals or orphaned remind threads in old threads |

Build it means: build on branch `feat/knowledge-alpha-standalone` off main `b1244bd3bc0` with my pick on each decision, pushing as I go. I open a draft PR once real code commits exist. Fayth reviews; no merge and no reviewer requests.
