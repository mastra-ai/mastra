# Knowledge alpha scope, v3 (draft report 20261023T223907)

This is a copy of the report blocks for Fayth's recheck. Everything was checked against main `b1244bd3bc0`.

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

Move `knowledge-tools`, `knowledge-write-tools`, `pinned`, `pinned-state-processor` (it becomes a plain input processor, section 3), `semantic-index` and `scope`. All six import only `@mastra/core/*` and `json-schema`, so core needs no new dependencies. It belongs in core and not a new package because `Agent` has to attach it, and the storage contract already lives there.

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

## 3. Running without Memory

**Tools work without Memory.**
- `agent.ts:8731-8745` resolves the thread and resource from call options and the reserved request-context ids, and the tool builder passes them through (`tool-builder/builder.ts:637-644, 739-740`).
- Scopes stay main's fixed chain: `org:<requestContext.organizationId>`, then `resource:` (the `knowledgeResourceId` override if set, else the run's resourceId), then `thread:`.
- Without an `organizationId` the tools and the pins processor both refuse or skip, as on main (D3). For Mastra Code sessions that can't resolve an org (today `hasSubconsciousTools` returns false), the agent simply gets no Knowledge tools or pins; nothing errors.

**Where `organizationId` and `knowledgeResourceId` come from.**
- Today the Mastra Code SDK stamps them only inside Memory resolution, and only when `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS=1` and a vector store exist (`sdk/agents/memory.ts:306-319`). Values come from `resolveKnowledgeScopeIdentity` (`sdk/knowledge-scope.ts`): Factory sessions get their seeded org and the project id as resource; every other session gets the hard-coded org `local` and no resource override, with no way to change either.
- With Memory's `knowledge` option removed (D4), that stamping moves to where the SDK attaches Knowledge to the agent. It runs whenever a Knowledge is attached (the switch or a caller-supplied `createMastraCode({ knowledge })`), not only when Subconscious and a vector store are on.
- `createMastraCode({ knowledge: { key, instance, organizationId?, resourceId? } })` gains two optional overrides. A caller-supplied instance (e.g. the Director dogfood) sets its own org and shared resource; without them it falls back to `resolveKnowledgeScopeIdentity` as today (`local`, or the Factory org and project). A Factory session with no org still resolves to nothing and gets no Knowledge tools or pins (D3).
- Outside Mastra Code, a plain `new Agent({ knowledge })` reads both keys from the request context the caller passes; the docs say so, and nothing stamps them for you.

**Pins can't use the state-signal lane.**
- `ProcessorRunner` throws `computeStateSignal requires Mastra memory…` (`processors/runner.ts:496`) and then loads the thread through Memory.
- Changing that is a core processor-API change, which needs its own PR (`packages/core/AGENTS.md`).
- **So pins become a plain input processor (`processInputStep`).** It adds one fixed context block of the visible pins each step. The block is rendered in a stable order, so the cached prompt prefix holds until a pin changes.
- We lose the snapshot+delta updates Subconscious had. Each pin change rewrites the block, which costs a cache miss from that point on.
- **The block sits in `systemMessages`, ahead of the conversation.** Pins live at the resource rung, so one agent's pin change is a full-prefix cache miss on the next turn of every agent sharing that resource (D7).
- Pins need `organizationId` and a resourceId. Without them the block is skipped, and the pin tools refuse rather than write pins nobody can read back (D7).

**Search.**
- `KnowledgeSemanticIndexCoordinator` moves into core and runs on the Knowledge's own vector store and embedder. Its index name stays `knowledge_documents_dimension_N`, which can't collide with Memory's `memory_messages`.
- Draining the outbox happens before every search (in bounded batches) and, without blocking, after each tool write.
- **Indexing lag:** records written by anything other than a tool, such as an import or a direct API call, are indexed only when some process next runs a search. A first search after a bulk import is slower.
- Without a vector store, search is keyword-only.
- **The store enqueues outbox rows on every write regardless of a vector store** (e.g. `inmemory.ts:370, 479-486, 505, 557-558`; LibSQL/PG the same). The alpha keeps that: rows stay pending, one per write, and if a vector store and embedder are added later the first search back-fills the index from them. The cost is outbox growth on keyword-only instances, one row per write (the Director dogfood, ~15 writers on one graph, grows with its write count). Pruning is left for later and will live in core Knowledge, next to the moved semantic-index coordinator, as a maintenance call that drops pending rows superseded by a newer row for the same target; the stores already expose `listSemanticOutbox`/claim/complete for it.

**What Memory still adds** when both are set: message history and OM. Memory no longer has a `knowledge` option (D4).

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
| Run scopes (`getRunAgentScopes`) | Wave 2 | Replace the alpha's fixed org→resource→thread chain |
| Token limits | Alpha | Recheck importers that write long record text against the 250-token limit |

**Kayle's Director dogfood plan.** She's replanning on the alpha. Per-request scopes wait for Wave 2: on main, `KnowledgeScopeLevel` is `org|resource|thread`, and nothing reads run scopes back (`getRunAgentScopes` isn't on main). Director members share a resourceId, so they share the resource level. The director's own session joins through the `knowledgeResourceId` override, which the alpha keeps unchanged.

## 6. Tests to add

- An agent with Knowledge and no Memory gets read tools only, by default. Its search is keyword-only without a vector store, and semantic with one.
- Write tools stamp `agent:<id>` as the source, and refuse without a thread or org.
- With no vector store, the outbox grows by exactly one row per write.
- `createMastraCode({ knowledge: { key, instance, organizationId, resourceId } })` with no Memory, the old Subconscious flag unset and no vector store: both keys reach the tool context (`resourceId` as `knowledgeResourceId`), and a write lands at `org:<override>` / `resource:<override>`.
- The pins processor gives a stable block from one run to the next. One user's pin shows in their other threads and never in another user's. The pin limits are enforced in tokens.
- Limit checks run at the new token bounds in the shared store contract (InMemory, LibSQL, PG).
- OM still strips old Subconscious signals from observer input, and `deleteThread` still removes owned remind threads.
- A Mastra Code agent still has its knowledge tools and pins after the SDK rewire.
- The TUI renders an old thread containing `subconscious-activity` signals without printing them.
- For each, a red control showing the test fails without the change.

## Open decisions

| # | Decision | My pick | Alternative |
|---|---|---|---|
| D1 | Name of the token-limit options | `maxTokens` (matches `messageTokens`/`observationTokens` in OM) | `tokenCount`, from Tyler's comment |
| D2 | Defaults when an agent has `knowledge` | read on, write off, pins off | everything off until set |
| D3 | No `organizationId` in request context | refuse, as on main | default to a local org |
| D4 | Memory's `knowledge` option | remove it; attach to the agent | keep it as a shortcut |
| D5 | Mastra Code switch | rename `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` (`sdk/agents/memory.ts:~250`) to `MASTRACODE_EXPERIMENTAL_KNOWLEDGE=1`; it attaches a Knowledge with read, write and pins on and no longer requires a vector store (without one, search is keyword-only) | keep the old flag name |
| D6 | Release note | Tyler's fixed wording, "Changes to an experimental, upcoming memory feature.", plus one line: "`experimental_subconscious` is removed; attach Knowledge to the agent instead." | wording only, no removal line |
| D7 | Pins without Memory | plain input processor, one fixed block in `systemMessages` (section 3); a pin change is a full-prefix cache miss for every agent on that resource | pins only on agents that also have Memory (state-signal lane, snapshot+delta) |
| D8 | Leftovers in existing threads | keep three small protections: OM strip of old signals, `deleteThread` remind cleanup, TUI skips old activity signals | drop them and accept raw signals or orphaned remind threads in old threads |

Build it means: branch `feat/knowledge-alpha-standalone` off main `b1244bd3bc0`, my pick on each decision, a draft PR from the first commit, Fayth reviews, no merge and no reviewer requests.
