# MessageList usage map

Source: `packages/core/src/agent/message-list/message-list.ts` on `feat/action-format` (= main + step 1).
Counts are non-test call sites in `packages/core/src` excluding `agent/message-list/` itself.
Outside core, `MessageList` is also imported by `packages/memory` (24 files, mostly observational memory),
`client-sdks/*` (11), `packages/server`, `playground*`, `agent-builder`, `deployer`, and most `stores/*`
(message conversion). The public API stays identical, so none of these change.

## How MessageList works today

- `messages: MastraDBMessage[]` is the one store. Each message is `{ id, role, createdAt, threadId,
  resourceId, content: { format: 2, parts[], metadata?, providerMetadata?, + v4 mirrors } }`.
- `stateManager` tags each message id with a **source**: `memory` (recalled), `input`, `response`,
  `context`, plus a parallel set of "persisted" tags (`*Persisted`) for what has already been saved.
- System messages live **outside** `messages`: `systemMessages[]` and `taggedSystemMessages{tag: []}`.
- Every view (`get.*.aiV4/aiV5/aiV6/aiV7/ui/core/v1/prompt/llmPrompt`) is computed from
  `get.<source>.db()` with existing converters.

**Consequence for the plan:** only one projection has to be built — `actions → MastraDBMessage[]`.
All other views keep running the existing converters over that output, unchanged.

## Methods, usage, and mapping

Areas: ag = agent, du = agent/durable, lo = loop, pr = processors, st = stream, wf = workflows.

### Reads (step 4, group 1)
| Method | Calls | Returns | Action-log mapping |
|---|---|---|---|
| `get.all.db` | 61 (pr 20, lo 19, du 11, ag 3, st 2, storage 3, browser 1) | `MastraDBMessage[]` | project whole log (minus system) |
| `get.input.db` / `get.response.db` / `get.remembered.db` | 10 / 20 / 1 | same, filtered by source | project, then filter by source sidecar |
| `get.{all,input,response}.aiV5.model` | 13 / 17 / 15 | AI SDK v5 ModelMessage[] | existing converter over projected db |
| `get.response.aiV5.{ui,stepContent,modelContent}` | 6 / 4 / 2 | v5 UI / step content | existing converter; `stepContent` needs step boundary (see turn-start) |
| `get.all.aiV{5,6,7}.llmPrompt` | 3 / 2 / 2 | provider prompt | existing converter |
| `get.all.{ui,core,v1,prompt}`, `get.response.aiV4.core` | 4 / 1 / 3 / 2 / 2 | legacy v4 shapes | existing converter |
| `get.all`, `get.response`, `get.remembered` (object passed around) | 6 / 3 / 1 | accessor object | unchanged object, backed by projection |
| `getLatestUserContent`, `getRememberedAndInputMessageIds`, `makeMessageSourceChecker` | 0 / 1 / 14 (wf 6, pr 6) | string / id sets | from projection + source sidecar |
| `dropsIncompleteToolCalls` | 1 | config flag | unchanged |

### Writes (step 4 groups 1, 3)
| Method | Calls | Does | Action-log mapping |
|---|---|---|---|
| `add(input, source, {merge})` | 44 (lo 15, ag 12, pr 10, du 3, st 2, a2a 2) | normalize + insert/merge by id | `toActions` on the normalized DB message → append; tag source; `merge` = same `messageId` |
| `addSignal` | 8 | add signal message | `signal` action (exists) |
| `updateToolInvocation` | 12 (lo 7, du 3, pr 2) | mutate a tool part's state/result | append `tool-result` / `tool-error` / `tool-denied`; projection folds by `toolCallId` |
| `addOutputErrorsToProviderToolCalls` | 1 | mark provider tool calls errored | append `tool-error` per call |
| `updateMessageMetadataByToolCallId` | 4 (du 2, lo 2) | write `content.metadata` (suspendedTools, pendingToolApprovals) | **gap D** |
| `removeByIds(ids, {pruned})` | 12 (all pr, mostly OM) | drop from context | drop actions with that `messageId` from the in-memory log; storage stays append-only; pruned ids tracked as today |
| `clear.input.db` | 2 | drop input messages | drop input-sourced actions |
| `drainUnavailableAttachmentUpdates` | 1 | attachment download failures | `file-unavailable` action (exists) |

### Step boundaries (step 4, group 1)
| Method | Calls | Action-log mapping |
|---|---|---|
| `openStepBoundary` / `stepStart` / `enrichLastStepStart(model)` | 2 / 0 / 1 | `turn-start` action (`modelId` = model) |
| `rollbackToStepBoundary(messageId, boundary)` | 4 (lo 3, du 1) | truncate log after the boundary's `turn-start` |
| `partsSinceStepBoundary` | 2 (st) | actions after last `turn-start`, projected |
| `rotateResponseMessageId` / `markResponseMessageBoundary` | 2 / 1 | start a new `messageId` for following assistant actions |
| serialized `lastStepBoundary {messageId, partIndex}` | — | becomes the `turn-start` action id |

### System messages (step 4, group 2)
| Method | Calls | Mapping |
|---|---|---|
| `addSystem(msg, tag?)` | 24 (pr 13, du 7) | **gap E** |
| `getSystemMessages(tag?)` / `getAllSystemMessages` | 21 / 13 | gap E |
| `clearSystemMessages(tag?)` / `replaceAllSystemMessages` | 0 / 10 (wf 6) | gap E |
| `getPersisted.taggedSystemMessages` | 4 | gap E |

### Serialize / persistence tracking (step 4 groups 4–5, step 5)
| Method | Calls | Mapping |
|---|---|---|
| `serialize` / `deserialize` | 23 (du 18) / 4 | state = `{ actions, sources, persisted, system, memoryInfo, … }`. **Durable workflow snapshots store this**, so the snapshot shape changes — gap F |
| `serializeForSpan` | 0 direct (tracing) | from projection |
| `getPersisted.{input,response,remembered}.{db,ui}` | 9 | persisted sidecar + projection |
| `drainUnsavedMessages`, `getEarliestUnsavedMessageTimestamp`, `isNewMessage` | 1 / 1 / 2 | persisted sidecar; step 5 drains actions for `saveActions` |
| `getRunResponseMessages` | 2 | projection + pruned ids loaded from memory (step 5: `listActions({ runId })`) |
| `transformMessagesForTranscript` | 1 | projection-level, unchanged |
| `startRecording` / `stopRecording` / `get/hasRecordedEvents` | 6 / 14 (all pr) | records mutations; unchanged, fired from log operations |

## Gaps — what the action format can't express yet

These need a decision before step 3. Each has my proposal.

**A. Message identity.** Actions have no `messageId`. `removeByIds`, `rollbackToStepBoundary`,
`rotateResponseMessageId`, `isNewMessage`, `add({merge})`, and every processor/memory path that keys on
message ids need it, and stored DB message ids must survive a round trip.
*Proposal:* add `messageId: string` to `ActionBase`, persisted.

**B. Source.** `memory` / `input` / `response` / `context` is list-local and not part of the conversation.
*Proposal:* keep it as a sidecar `Map<messageId, source>` inside MessageList (exactly what
`stateManager` does now). Not stored on actions.

**C. Part details the actions lack.** Per-part `createdAt`; tool part interim states
(`partial-call`, `call`) and in-place `args` updates; v4 mirror fields (`content` string,
`toolInvocations`, `reasoning`, `experimental_attachments`, `annotations`).
*Proposal:* states and mirrors are derived at projection time (today's converters already rebuild them,
except `annotations`). Add optional `partCreatedAt` if the shadow comparison in step 3 shows it matters.
`annotations` gets checked in step 3; if anything sets it, it becomes a field.
Also: `updateToolInvocation` has a fallback that **rewrites a pending provider-executed call's
`toolCallId`** to the result's id (Google `file_search`), and can attach `metadata` to the message.
An append-only log can't rewrite. *Proposal:* the `tool-result` action carries `replacesToolCallId`, and
the projection applies it, so replay sends a consistent id.

**D. Message-level metadata.** `content.metadata` is read by Mastra itself: `signal` (43 reads),
`suspendedTools` (14), `mode` (12), `state`, `structuredOutput`, `pendingToolApprovals`,
`completionResult`, `goalEvaluation`, `customProcessorData`, user metadata. But `ActionBase.metadata`
is documented as "user-owned, Mastra never reads".
*Proposal:* the parts that are events become actions that already exist (`pendingToolApprovals` →
`tool-approval-requested`, `suspendedTools` → `tool-suspended`, `structuredOutput` →
`structured-output`). Everything else is carried verbatim as `messageMetadata` on the message's first
action, so the projection is exact. Drop the "Mastra never reads" claim on `metadata`, or keep it and use
the new field — your call.

**E. System messages.** Today they are not conversation messages and are never saved to memory, apart
from `taggedSystemMessages` exposed via `getPersisted`.
*Proposal:* keep them outside the action log, unchanged. Step 4 group 2 then becomes "no change". The
alternative is `text` actions with `role: 'system'` and a new `tag` field — more churn, nothing gained
that I can see.

**F. Durable snapshot shape.** `serialize()` output is stored in workflow snapshots (18 durable call
sites). Changing it means a run suspended before the upgrade can't resume after.
*Proposal:* `deserialize` accepts both the old shape (via `toActions` on its messages) and the new one.
This is the one place I'd keep the old reader, because users can have suspended runs in storage.

## What stays exactly the same
- Every public method name and signature above.
- All AI SDK views (they're converters over `db()`).
- Recording, `dropsIncompleteToolCalls`, attachment download cache, ID generator hook.
