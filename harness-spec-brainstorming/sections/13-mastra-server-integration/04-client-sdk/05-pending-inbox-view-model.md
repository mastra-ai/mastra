### 13.4e Pending Inbox View Model

**Pending inbox view model.** `RemoteSession` exposes a normalized
`PendingInboxItem` projection for first-party clients and composer adapters that
render tool approvals, tool suspensions, questions, and plan approvals. This is
a client-side projection only: the authoritative pending payloads remain the
four `SessionRecord` pending shapes in §5.1, live pending notifications remain
the `SuspensionEvent` shapes in §10.2, and response semantics remain the
`respondTo*` / `InboxResponseResult` contract in §4.2 / §4.4.

```ts
// Kind literals mirror the canonical session-record kinds at §5.1b.1
// (`PendingInboxKind`); per the existing "if §13.4 and §5.1 disagree, §5.1
// wins" rule, the projection re-exports the canonical type rather than
// redeclaring it. Any change to the literal set is a public-API change
// governed by §11.6.
type PendingInboxItemKind = PendingInboxKind;

type PendingInboxCardState =
  // Server-derived render states.
  | 'pending'       // pending field exists and no response has won yet
  | 'accepted'      // response receipt won; resume is still applying/retrying
  | 'applied'       // resume completed and exact retries return the result
  | 'failed'        // response/resume became terminally unavailable
  // Client-local render/transport states.
  | 'submitting'    // HTTP request in flight; keep the same responseId
  | 'stale'         // owning session/item disappeared or closed before answer
  | 'consumed'      // prompt disappeared because another actor answered it
  | 'conflicted';   // server rejected a competing or mismatched response

interface PendingInboxItemBase {
  owningSessionId: string;        // URL target for POST /sessions/:owningSessionId/inbox/:itemId
  itemId: string;
  kind: PendingInboxItemKind;
  runId: string;
  requestedAt: number;
  source: 'parent' | 'subagent';
  subagentSessionId?: string;     // present when source === 'subagent'
  subagentToolCallId?: string;
  state: PendingInboxCardState;
  responseId?: string;            // retained while submitting/retrying
}

type PendingInboxItem =
  | (PendingInboxItemBase & {
      kind: 'tool-approval';
      toolCallId: string;
      toolName: string;
      toolCategory?: string;
      input: JsonValue;
    })
  | (PendingInboxItemBase & {
      kind: 'tool-suspension';
      toolCallId: string;
      toolName: string;
      suspendData: JsonValue;
    })
  | (PendingInboxItemBase & {
      kind: 'question';
      toolCallId: string;
      question: string;
      options?: { label: string; description?: string }[];
      selectionMode?: 'single_select' | 'multi_select';
    })
  | (PendingInboxItemBase & {
      kind: 'plan-approval';
      toolCallId: string;
      title: string;
      plan: string;
    });
```

The projection adds only routing and client-state fields. Kind-specific payload
fields mirror the corresponding §5.1 pending shape; if §13.4 and §5.1 disagree,
§5.1 wins. `owningSessionId` is derived from ownership, not user input: for
`source: 'parent'` it is the viewed session ID; for `source: 'subagent'` it is
the `subagentSessionId` from the event or subagent inbox response. Clients de-dupe
and merge items by `(owningSessionId, itemId, kind, runId, requestedAt)`.

Pending inbox helpers construct this view from three sources:

- live `SuspensionEvent`s on the session stream (§10.2), including subagent
  pending events surfaced on the parent stream;
- current pending records exposed by the session snapshot/display snapshot for
  the viewed session; any snapshot field that carries parent-owned pending
  prompts must project through this shape; and
- `GET /sessions/:sessionId/subagent-inbox`, which returns active descendant
  pending prompts with their owning subagent session and kind-specific render
  payload (§13.2).

After an SSE `412` replay gap, the SDK refreshes the session snapshot, checks
unresolved message/queue operations as described below, and refreshes
`/subagent-inbox` before presenting pending cards. Previously-known items that
are absent from the refreshed sources transition to `consumed` when another
response is known or likely to have won, or `stale` when the owning session is
closing/closed, missing, or no longer has that pending item. These are
client-derived render states, not new `InboxResponseReceipt.status` values.

`RemoteSession` may expose a convenience response helper such as
`respondToPendingItem(item, response, opts?)`, but it is only a wrapper around
the existing response methods and route contract. The helper posts to
`POST /harness/:name/sessions/:owningSessionId/inbox/:itemId`, never to the
viewed parent session unless that parent owns the item. It accepts a caller
`responseId` or generates one before the HTTP request; while the request is
`submitting`, SDK retries reuse that same `responseId`. The helper maps the
owning route's `accepted` / `applied` response contract (§4.4, §13.2) into this
client view. `404
harness.inbox_item_not_found`, `409 harness.session_closing`, and `404
harness.session_closed` map to stale/consumed render states after a refresh;
`HarnessInboxResponseConflictError` / `409 harness.inbox_response_conflict` maps
to `conflicted`. `HarnessRecoveryDeferredError` /
`503 harness.recovery_deferred` keeps the card in the accepted/retryable path:
the SDK retries the owning-session inbox route with the same `responseId` and
refreshes the relevant read models. Generic transport failures leave the card
`failed` only after the SDK cannot prove whether the response was accepted by
retrying the same `responseId` against the owning-session inbox route and
refreshing the relevant read models; otherwise the card remains retryable with
the retained `responseId`.
