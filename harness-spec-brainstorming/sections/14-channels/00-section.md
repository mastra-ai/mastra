## 14. Channels

Mastra already has per-agent channel transports (`packages/core/src/channels`).
`AgentChannels` is one bot identity across platforms and currently wires
provider adapters to a live path: platform webhook -> channel thread mapping ->
`agent.stream(...)` -> platform post/edit. Harness v1 does not replace those
adapters. It specifies the control-plane bridge that lets channel traffic
preserve Harness session identity, permissions, durability, approvals, replay
boundaries, and proactive outbound delivery.

Channels are a source-specific bridge, not an independent execution domain or
workflow engine. Durable channel rows exist for provider ingress, provider
callback ownership, inbox actions, wakeup handoff, provider-visible outbound
delivery, retry, de-duplication, and crash recovery. They do not run
agent/workflow logic independently and they do not own session-local run,
thread, queue, pending-item, or state mutation. Any channel path that changes
conversation state enters the owning Harness Session through
`harness.session(...)`, `session.message(...)`, `session.queue(...)`, or the
normal inbox response methods under the session authority. Generic external
source ledgers and operator repair APIs remain outside Harness v1 (§5.2,
§15.3).

Channels are coordinated at two levels:

- **Mastra Server registry** — process-wide. Knows every registered harness,
every registered channel provider, and which `(harnessName, channelId)` pairs
are mounted. It owns init-time validation and route fan-out (§13.1).
- **Harness channel bridge** — per harness. Owns binding resolution, session
admission, inbox/outbox persistence, permissions, and approval routing for
sessions under that harness.

This split is what lets one Mastra Server run multiple harnesses against
multiple channel providers without making any one harness guess what else is
installed.

The safety condition is one owner per provider callback target. A callback
target is the trusted route or installation handle a provider uses to accept
inbound events or actions: for example a Harness-scoped
`/harness/:harnessName/channels/:channelId/...` route, a provider route key, a
webhook installation ID, or an external tenant handle the provider has
authenticated. Sharing the same `ChannelProvider` instance is safe only when the
registry can map every callback target to exactly one Harness channel pair or to
exactly one legacy live-agent owner. Direct Harness routes and provider-owned
routes may coexist in one server, but not as two active ingress paths for the
same callback target.

The v1 rule is:

```
Channel inbound -> resolveChannelBinding(...) -> harness.session(...) -> session.message(...) / session.queue(...)
Session output / inbox prompt -> HarnessChannelOutbox -> channel adapter post/edit
Channel action -> session inbox response
```

Orientation diagram (channel flow only; detailed record contracts below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-channel-flow-title hx-channel-flow-desc" viewBox="0 0 1160 680" width="100%" style="max-width: 1160px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-channel-flow-title">Channel inbound, action, and outbound flow</title>
    <desc id="hx-channel-flow-desc">Provider callbacks and actions enter through the registry and adapter into inbox or action receipts, while session outbox projection is dispatched by workers that consult the registry laterally before calling provider APIs.</desc>
    <defs>
      <marker id="ah-channel-flow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="55" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="130" y="83" text-anchor="middle">Provider callback</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="130" y="105" text-anchor="middle">webhook ingress</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="285" y="55" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="83" text-anchor="middle">Server registry</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="105" text-anchor="middle">harness/channel lookup</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="560" y="55" width="190" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="83" text-anchor="middle">Adapter</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="105" text-anchor="middle">verify / normalize</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="815" y="55" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="83" text-anchor="middle">ChannelInboxItem</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="105" text-anchor="middle">inbound ledger</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="815" y="185" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="213" text-anchor="middle">ChannelBinding</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="235" text-anchor="middle">owning session</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="560" y="185" width="190" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="213" text-anchor="middle">Harness Session</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="235" text-anchor="middle">admission owner</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="285" y="185" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="213" text-anchor="middle">Message or queue</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="235" text-anchor="middle">session admission</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="335" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="130" y="363" text-anchor="middle">Provider action</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="130" y="385" text-anchor="middle">button/form event</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="285" y="335" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="363" text-anchor="middle">Action receipt</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="385" text-anchor="middle">ChannelActionReceipt</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="560" y="335" width="190" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="363" text-anchor="middle">Inbox response</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="385" text-anchor="middle">owning-session reply</text>

    <rect style="fill: #fefce8; stroke: #eab308; stroke-width: 2; rx: 14;" x="560" y="500" width="190" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="528" text-anchor="middle">Outbox projection</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="550" text-anchor="middle">session delivery intent</text>

    <rect style="fill: #fefce8; stroke: #eab308; stroke-width: 2; rx: 14;" x="815" y="500" width="210" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="528" text-anchor="middle">ChannelOutboxItem</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="550" text-anchor="middle">dispatch ledger</text>

    <rect style="fill: #fefce8; stroke: #eab308; stroke-width: 2; rx: 14;" x="815" y="600" width="210" height="56" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="624" text-anchor="middle">Dispatch worker</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="645" text-anchor="middle">claims outbound work</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="560" y="600" width="190" height="56" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="624" text-anchor="middle">Provider API</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="645" text-anchor="middle">external delivery</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M220 88 L284 88" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M495 88 L559 88" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M750 88 L814 88" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M920 121 L920 184" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M815 218 L751 218" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M560 218 L496 218" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M220 368 C245 255 300 150 364 122" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M390 122 L390 334" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M495 368 L559 368" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M655 335 L655 252" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M655 251 L655 499" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M750 533 L814 533" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M920 566 L920 599" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-flow);" d="M815 628 L751 628" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-channel-flow);" d="M820 615 C645 575 485 350 410 122" />
  </svg>
  <figcaption>Channel ingress and actions are routed through the registry before session admission; outbound dispatch reads the outbox and consults the registry laterally before calling the provider API.</figcaption>
</figure>

Channel integrations MUST NOT call `agent.stream(...)`, `agent.generate(...)`,
`agent.approveToolCall(...)`, `agent.resumeStream(...)`,
`agent.resumeGenerate(...)`, or `sdkThread.post(...)` as the only delivery path
when operating in Harness mode. Those calls are implementation details behind
either session admission, owning-session inbox response, or outbox dispatch.

This fence includes reused `AgentChannels` conveniences. Existing provider
adapters, formatters, and platform verification logic may be reused behind the
bridge, but the live `AgentChannels` route/action/tool surface is not active for
a harness-bound target. The Harness channel bridge MUST NOT merge
`AgentChannels.getTools()` direct-provider tools into the model-visible tool
surface for any session turn admitted under an active `ChannelBinding`; this
strip is evaluated on the final merged tool surface (after per-turn `addTools` /
`useSkill` contributions) at the §4.2 pre-exposure gate and is the load-bearing
enforcement of the §14.7 init fence. In Harness mode, channel tools that
post/edit/react on the platform must enqueue outbox work or become internal
adapter helpers; they must not be injected into a run as direct platform side
effects for the same binding. The bridge substitutes the Harness-owned
outbox-backed reaction tools defined in §14.4 by default; deployment policy MAY
disable the substitute per harness or per binding, in which case the model sees
no reaction tool from the channel slot for that turn.
`requestContext.channel.capabilities` remains descriptive metadata that informs
tool-availability decisions but never the delivery authority; absence of an
active binding for a channel-origin turn follows the §14.3 binding-backed
admission rules and does not fall back to the legacy live adapter path.

The public Harness surface for adapters is intentionally small:

```ts
interface ResolveChannelBindingOptions {
  channelId: string;
  providerId: string;
  envelope: ChannelIngressEnvelope;
}

interface ChannelIngressOptions {
  channelId: string;
  raw: unknown;
  delivery?: 'message' | 'queue';
}

interface ChannelIngressResult {
  inboxItemId: string;
  status: ChannelInboxItem['status'];
  bindingId?: string;
  sessionId?: string;
  delivery?: 'message' | 'queue';
  runId?: string;
  queuedItemId?: string;
  duplicate: boolean;
}

interface ChannelActionOptions {
  channelId: string;
  raw: unknown;
}

interface ChannelActionResult {
  actionId: string;
  actionTokenId: string;
  status: 'received' | 'accepted' | 'applied' | 'conflict' | 'failed' | 'dead';
  owningSessionId: string;
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  duplicate: boolean;
}

interface ChannelOutboxEnqueueOptions {
  bindingId: string;                 // delivery binding / platform target
  owningSessionId?: string;          // defaults to the binding's session
  kind: ChannelOutboxItem['kind'];
  // Trusted bridge/adapter operation identity for delivery semantics. External
  // provider payload fields never set these directly. When omitted, the adapter
  // resolves them from the candidate row's kind and payload.
  operationKind?: ChannelOutboxOperationKind;
  operationName?: string;
  deliverySemantics?: ChannelDeliverySemantics;
  // Candidate adapter/bridge payload. The durable row stores only the
  // adapter-normalized `JsonValue` produced from this candidate.
  payload: unknown;
  idempotencyKey: string;
}

interface ChannelDispatchOptions {
  channelId?: string;
  limit?: number;
}

interface MastraChannelOperatorDispatchOptions extends ChannelDispatchOptions {
  harnessName?: string;              // omitted only for an explicit cross-harness operator worker
}

interface ChannelDispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
}
```

When a bridge enqueues outbox work, it loads the active `ChannelBinding` for
`bindingId` and copies the current `providerId`, `bindingGeneration`, session
identity, and durable target identifiers onto the row. Callers do not supply or
override those identity fields through `ChannelOutboxEnqueueOptions`.

Before the row is written, the bridge resolves an operation delivery plan.
`kind` remains the Harness projection category, while `operationKind` /
`operationName` identify the adapter-normalized provider operation that will be
attempted. The bridge first asks `adapter.resolveDeliveryPlan(...)` when
present. Otherwise it uses trusted enqueue operation fields, then
`adapter.deliverySemanticsByOperation`, then the adapter-level
`deliverySemantics`, and finally `'at-least-once'`. If neither the adapter nor
trusted enqueue path provides an operation kind, the bridge snapshots
`operationKind: 'custom'`, a stable `operationName` derived from the Harness
`kind`, and `deliverySemantics: 'at-least-once'` rather than inferring a
stronger guarantee. If the operation is provider-specific or falls under
`custom`, `operationName` must be stable enough for duplicate checks,
reconciliation, and diagnostics. Provider payload fields never choose
`operationKind`, `operationName`, or `deliverySemantics` directly.

`ChannelOutboxEnqueueOptions.payload` is a candidate value at the trusted
bridge/adapter boundary, not the stored shape. Before computing `payloadHash` or
calling storage, the bridge validates or normalizes it to a `JsonValue` and
stores that exact JSON value on `ChannelOutboxItem.payload`. Non-JSON or lossy
payload candidates fail before any durable row is created or mutated; adapters
must convert provider SDK objects such as dates, buffers, class instances, or
temporary file handles into explicit JSON DTOs or durable attachment references.
