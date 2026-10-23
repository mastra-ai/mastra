# Knowledge alpha scope, v5 (report 20261023T223907)

Everything here was checked against main `b1244bd3bc0`. v5 follows Tyler's three comments (thread ans-2026-10-23T22:58:30.509Z):
- Knowledge reads the run's tagged scopes, including the `scopes` key agent methods already take.
- `organizationId` and `knowledgeResourceId` are deleted.
- Pins stay a prompt-cacheable state signal.

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
- The run hands its non-identity tags downstream in a trusted copy of the request context (`deriveAgentRunRequestContext`, `scopes.ts:286`; values marked in a WeakSet at `:51-59`). Nothing on main reads them back. **The alpha adds the reader `getRunAgentScopes(requestContext)`, about 10 lines in `agent/scopes.ts`.** It returns the tags only when the WeakSet marks them as the run's own, so a caller can't forge them by writing `mastra__scopes` into a request context. Wave 2 has the same function (section 5).
- **A run's Knowledge scope** = those tags, plus `resource:<resourceId>` and `thread:<threadId>` from the run's identity when it has them. Tools and the pins processor compute it per call from trusted context; the model never supplies a scope.
- **`organizationId` and `knowledgeResourceId` are deleted** as Knowledge inputs: the request-context keys, the SDK stamping (`sdk/agents/memory.ts:306-319`), `subconscious/scope.ts`, and the overrides v4 proposed for `createMastraCode`. An org is just an `org:` tag. D3 (refuse without an org) goes away: a run without an `org:` tag simply holds fewer tags.

**The store accepts any tag type.**
- On main, `canonicalizeKnowledgeScope` (`storage/domains/knowledge/base.ts:685`) rejects any type except `org|resource|thread`. It also requires `thread` to have `resource` and `org` ancestors, and `resource` to have `org`. `KnowledgeScopeLevel` is that union (`base.ts:6`).
- The alpha relaxes it so any `<type>:<value>` matching the agent scope pattern (`SCOPE_TYPE_PATTERN`, `agent/scopes.ts`) is accepted, one value per type. The ancestor rules go, since tags don't form a chain.
- **Visibility doesn't change.** A record is visible when its scope is a subset of the run's (`isKnowledgeScopeVisible`, `base.ts:728`), and that works for any tags.
- **Stored keys don't change.** The sort keeps `org`, `resource`, `thread` first and orders other types by name, so every scope key already written stays the same.
- Adapters import `canonicalizeKnowledgeScope` from `@mastra/core` at runtime (e.g. libsql `knowledge/index.ts:47`), so LibSQL, PG, MySQL and Mongo need no code change. An adapter running against an older core still rejects new tag types, so it fails closed.
- **Limit: 8 tags per run.** Visible-scope lookup enumerates every subset of the run's tags (libsql `visibleScopeKeys`, `:139`; core `knowledgeVisibleScopeKeys`, `base.ts:733`), so 8 tags means 255 keys. A run with more than 8 tags gets no Knowledge tools or pins, and the error says why.
- The `:uncurated` companion entries were Subconscious-only, so their handling goes.
- `expandKnowledgeScope(context, level)` and `KnowledgeScopeLevel` are replaced by a tag subset: "keep these tag types" instead of "widen to this rung".

**Where writes land.**
- A write lands at every tag the run holds by default, which is the most private placement. The model can name a subset of the run's tag types to share wider (e.g. drop `thread` and `resource` to write at `org` + `team`). It can't add a tag or write with none.
- Agent tools are resolved per run, so each tool schema's enum of tag types is built from that run's tags. That also fixes the per-run baking in today's write tools (`knowledge-write-tools.ts:12-20`).
- Pins default to every tag except `thread`, so a pin follows the user across threads. That matches today's resource-level pins when a run holds org, resource and thread.

**What Mastra Code passes.**
- Local TUI/studio sessions keep `org:local`, so existing local Knowledge stays visible.
- Factory sessions pass `org:<factoryOrg>` and `project:<projectId>`. The project used to sit in the resource slot through `knowledgeResourceId`. A `resource:` tag must equal the Memory resource (`resolveAgentScopes` throws otherwise), so the project becomes its own tag.
- Factory Knowledge already written under `resource:<projectId>` will no longer be visible. It was only written with the experimental Subconscious flag on (D9).
- A Factory session whose org can't be resolved still gets no Knowledge, as today.
- The Director dogfood just passes its tags (`org:…`, `team:director`, `agent:<name>`, `request:r25`). Per-request scopes therefore work in the alpha, without Wave 2.

**Pins stay a state signal, so pins need Memory.**
- The pins processor stays `PinnedStateProcessor` on the state-signal lane: a snapshot first, then deltas, and nothing when the pins are unchanged. That keeps the prompt cacheable, as it is today. v4's system-prompt block is gone.
- The lane persists signals in the thread through Memory. `ProcessorRunner` throws without Memory (`processors/runner.ts:496`) and loads the thread from it.
- So **pins are on only when the agent has both a Knowledge with `pins` and a Memory.** The Agent, not Memory, adds the processor, de-duplicated by its state id.
- An agent with Knowledge and no Memory gets read/write tools but no pin tools and no pins processor, and logs one warning if `pins` is set. Pin tools never show up where nothing could read the pins back.
- Pins also need a resourceId and threadId, as on main (`runner.ts:503-510` skips without them).

**Tools without Memory.** `agent.ts:8731-8745` resolves the thread and resource from call options and the reserved request-context ids, and the tool builder passes them through (`tool-builder/builder.ts:637-644, 739-740`). Write tools need a thread, as on main. Their records come from runs with no Memory history, which is fine.

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

**Kayle's Director dogfood plan.** It works on the alpha as-is. Each run passes its tags through `scopes` (`org:…`, `team:director`, `agent:<name>`, `request:r25`), and the store accepts them. Nothing is stamped through `organizationId` or `knowledgeResourceId`. Pins need Memory, which Director sessions already have.

## 6. Tests to add

- An agent with Knowledge and no Memory gets read tools only, by default. Its search is keyword-only without a vector store, and semantic with one.
- Write tools stamp `agent:<id>` as the source, and refuse without a thread.
- With no vector store, the outbox grows by exactly one row per write.
- Tagged scopes: a run with `scopes: ['org:acme', 'team:a']` writes at those tags plus its resource and thread. A run tagged `team:b` can't see it. A run tagged `org:acme` only sees what was written with the `team` tag dropped.
- Tags set in `mastra__scopes` by the caller, without the run's WeakSet mark, are ignored by `getRunAgentScopes`.
- The store accepts `request:r25`-style tags on InMemory, LibSQL and PG. Scope keys already written for `org`/`resource`/`thread` are byte-identical before and after. A run with 9 tags is refused.
- Mastra Code: a local session reads Knowledge it wrote before the change under `org:local`. A Factory session writes under `org:<org>` + `project:<id>`.
- Pins: with Knowledge `pins` and Memory, the state signal sends a snapshot, then deltas, and nothing when unchanged. One user's pin shows in their other threads and never in another user's. Without Memory, no pin tools and no processor. Pin limits are enforced in tokens.
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
| D3 | ~~No `organizationId`~~ | removed: `organizationId` is gone, an org is an `org:` tag | |
| D4 | Memory's `knowledge` option | remove it; attach to the agent | keep it as a shortcut |
| D5 | Mastra Code switch | rename `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` (`sdk/agents/memory.ts:~250`) to `MASTRACODE_EXPERIMENTAL_KNOWLEDGE=1`; it attaches a Knowledge with read, write and pins on and no longer requires a vector store (without one, search is keyword-only) | keep the old flag name |
| D6 | Release note | Tyler's fixed wording, "Changes to an experimental, upcoming memory feature.", plus one line: "`experimental_subconscious` is removed; attach Knowledge to the agent instead." | wording only, no removal line |
| D7 | Pins without Memory | settled by Tyler: pins stay a state signal, so they need Memory; a Knowledge-only agent gets no pins | |
| D9 | Factory Knowledge already written under `resource:<projectId>` | accept that it goes out of view; it exists only where the experimental Subconscious flag was on | migrate those rows to `project:<id>` tags |
| D8 | Leftovers in existing threads | keep three small protections: OM strip of old signals, `deleteThread` remind cleanup, TUI skips old activity signals | drop them and accept raw signals or orphaned remind threads in old threads |

Build it means: build on branch `feat/knowledge-alpha-standalone` off main `b1244bd3bc0` with my pick on each decision, pushing as I go. I open a draft PR once real code commits exist. Fayth reviews; no merge and no reviewer requests.
