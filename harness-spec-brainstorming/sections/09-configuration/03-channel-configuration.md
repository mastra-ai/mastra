### 9.3 Channel Configuration

Orientation diagram (per-channel config topology only; the TypeScript shapes
below remain authoritative for fields, defaults, envelope types, and adapter
contracts):

<figure>
  <svg role="img" aria-labelledby="hx-channel-config-title hx-channel-config-desc" viewBox="0 0 1040 560" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-channel-config-title">HarnessChannelConfig topology</title>
    <desc id="hx-channel-config-desc">Each registered channel has identity, an adapter, an ingress policy, and per-worker recovery configs. Delivery semantics resolve through resolveDeliveryPlan, the per-operation map, the adapter default, then at-least-once. Envelopes flow from raw transport requests to verified ingress and action shapes.</desc>
    <defs>
      <marker id="ah-channel-config" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="340" y="28" width="360" height="80" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="60" text-anchor="middle">HarnessChannelConfig</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="84" text-anchor="middle">one record per registered channelId</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="148" width="220" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="176" text-anchor="middle">Identity</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="200" text-anchor="middle">providerId</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="218" text-anchor="middle">(Mastra channels key)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="240" text-anchor="middle">platform</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="150" y="258" text-anchor="middle">required for mounted routes</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="280" y="148" width="220" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="176" text-anchor="middle">adapter</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="200" text-anchor="middle">verifyInbound · verifyAction</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="218" text-anchor="middle">deliver · reconcileDelivery</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="236" text-anchor="middle">resolveDeliveryPlan</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="254" text-anchor="middle">deliverySemantics + ByOperation</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="520" y="148" width="220" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="176" text-anchor="middle">ingress policy</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="200" text-anchor="middle">defaultDelivery</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="218" text-anchor="middle">dms · mentions · sharedThreads</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="236" text-anchor="middle">resolveResource(ctx) →</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="254" text-anchor="middle">resourceId · threadId · admission</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="760" y="148" width="240" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="176" text-anchor="middle">worker recovery configs</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="200" text-anchor="middle">inbox · actions · outbox</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="218" text-anchor="middle">claim TTL · renew · batch</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="236" text-anchor="middle">retry backoff · maxAttempts</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="254" text-anchor="middle">maxClockSkew</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M450 108 L150 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M490 108 L390 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M550 108 L630 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M600 108 L880 147" />

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="304">Delivery semantics resolution (per outbox row, snapshotted at enqueue)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="316" width="220" height="60" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="342" text-anchor="middle">resolveDeliveryPlan(item)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="361" text-anchor="middle">trusted bridge fields</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="290" y="316" width="220" height="60" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="342" text-anchor="middle">deliverySemanticsByOperation</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="361" text-anchor="middle">per operationKind map</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="540" y="316" width="220" height="60" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="650" y="342" text-anchor="middle">adapter deliverySemantics</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="650" y="361" text-anchor="middle">adapter-wide fallback</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="790" y="316" width="210" height="60" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="895" y="342" text-anchor="middle">at-least-once</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="361" text-anchor="middle">spec fallback</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M260 346 L289 346" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M510 346 L539 346" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M760 346 L789 346" />

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="408">Envelope flow (adapter-boundary; raw payloads never reach storage)</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="40" y="420" width="300" height="80" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="190" y="448" text-anchor="middle">HarnessChannelTransportRequest</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="190" y="468" text-anchor="middle">raw bytes + headers</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="190" y="486" text-anchor="middle">(preserves provider signatures)</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="370" y="420" width="280" height="80" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="510" y="448" text-anchor="middle">ChannelIngressEnvelope</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="510" y="468" text-anchor="middle">verifyInbound result</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="510" y="486" text-anchor="middle">canonical external IDs + content</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="680" y="420" width="320" height="80" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="840" y="448" text-anchor="middle">ChannelActionEnvelope</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="840" y="468" text-anchor="middle">verifyAction result</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="840" y="486" text-anchor="middle">actionId · token · response · actor</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-channel-config);" d="M340 460 L369 460" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-channel-config);" d="M340 480 L679 480" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="445" y="500">(action callback path)</text>

    <rect style="fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="40" y="514" width="960" height="34" />
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="536">Per-row enqueue snapshots the resolved operationKind, optional operationName, and deliverySemantics; later runtime changes do not re-decide existing rows.</text>
  </svg>
  <figcaption>Each channel record wires identity, adapter, ingress policy, and worker recovery; the delivery semantics resolution chain and the verified-envelope flow are the two cross-cutting paths declared in this section.</figcaption>
</figure>

```ts
interface HarnessChannelConfig {
  providerId?: string;                              // Defaults to this record's channelId.
                                                    // This is the Mastra channels registration key,
                                                    // not the provider's platform/type id.
                                                    // Required for Mastra Server-mounted channels.
                                                    // Provider-less adapters are local/test-only and
                                                    // are not exposed as external webhook routes.
  platform?: string;                                // Defaults to the provider's platform/id
  adapter: HarnessChannelAdapter;
  ingress: ChannelIngressPolicy;
  inbox?: {
    maxAttempts?: number;                            // Default: 10
    claimTtlMs?: number;                             // Default: 30_000
    claimRenewMs?: number;                           // Default: claimTtlMs / 3
    maxClockSkewMs?: number;                         // Required when adapter time is not storage-authoritative
    batchSize?: number;                              // Default: 50
    retryBackoffMs?: (attempt: number) => number;    // Default: exponential with jitter
  };
  actions?: {
    maxAttempts?: number;                            // Default: 10
    claimTtlMs?: number;                             // Default: 30_000
    claimRenewMs?: number;                           // Default: claimTtlMs / 3
    maxClockSkewMs?: number;                         // Required when adapter time is not storage-authoritative
    batchSize?: number;                              // Default: 50
    retryBackoffMs?: (attempt: number) => number;    // Default: exponential with jitter
  };
  outbox?: {
    maxAttempts?: number;                            // Default: 10
    // `claimTtlMs`, `claimRenewMs`, and `maxClockSkewMs` mirror the §9.1
    // `backgroundTasks` defaults so operators learn one timing dialect across
    // the claim/renew/retry/cleanup substrate; see §14.4 prior-art citation of
    // `packages/core/src/background-tasks/manager.ts`. Channel-specific
    // overrides are reserved for cases where channel delivery semantics
    // require tighter timing.
    claimTtlMs?: number;                             // Default: 30_000
    claimRenewMs?: number;                           // Default: claimTtlMs / 3
    maxClockSkewMs?: number;                         // Required when adapter time is not storage-authoritative
    batchSize?: number;                              // Default: 50
    pollIntervalMs?: number;                         // Default: 1_000 for built-in workers
    retryBackoffMs?: (attempt: number) => number;    // Default: exponential with jitter
  };
}

interface ChannelIngressPolicy {
  defaultDelivery?: 'message' | 'queue';             // Default: 'message'
  // Declarative gates checked before `resolveResource`. They constrain which
  // conversation shapes may create or reuse bindings; they do not by
  // themselves derive Harness identity from platform payload fields.
  dms?: 'per-user-resource' | 'shared-resource' | 'reject';
  mentions?: 'thread-resource' | 'shared-resource' | 'reject';
  sharedThreads?: 'shared-resource' | 'reject';
  // This is both the mapping and authorization decision for channel ingress:
  // the policy must reject actors that are not allowed to speak for the
  // resolved logical resource, and it must not infer cross-platform identity
  // from display names or raw platform user IDs.
  resolveResource: (ctx: ChannelIngressContext) => Promise<{
    resourceId: string;
    threadId?: string;
    sessionId?: string;
    mode: ChannelBinding['mode'];
    // Optional per-turn admission policy chosen by trusted server code.
    // These fields are ordinary `session.message(...)` / `session.queue(...)`
    // overrides, not session-default mutations. They must be deterministic
    // from the verified envelope and application policy, persisted on the
    // ChannelInboxItem before session admission, and replayed unchanged on
    // retry. Provider payload fields never set them directly.
    admission?: {
      delivery?: 'message' | 'queue';
      mode?: string;
      model?: string;
    };
  }>;
}

type ChannelDeliverySemantics = 'native-idempotency' | 'client-message-id' | 'lookup-reconcile' | 'at-least-once';

type ChannelOutboxOperationKind =
  | 'message-create'
  | 'message-edit'
  | 'reaction-add'
  | 'reaction-remove'
  | 'file-upload'
  | 'custom';

interface ChannelOutboxDeliveryPlan {
  operationKind: ChannelOutboxOperationKind;
  // Adapter-normalized provider operation name. Required for `custom`, and
  // useful when a provider splits one Harness outbox kind across multiple APIs.
  operationName?: string;
  deliverySemantics: ChannelDeliverySemantics;
}

interface HarnessChannelTransportRequest {
  method: string;
  path: string;
  url?: string;
  headers: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  // Raw, unparsed request bytes/string as received from the provider route.
  // Required for providers whose signatures cover the exact body.
  rawBody?: Uint8Array | string;
  body?: unknown;
  receivedAt?: number;
}

interface HarnessChannelAdapter {
  // Required for externally mounted provider routes. Local/test adapters that
  // omit verification are not exposed as Mastra Server webhook routes. The
  // transport request preserves headers and raw body material needed for
  // provider signature checks; parsed provider payload fields never select the
  // Harness target by themselves.
  verifyInbound?(
    request: HarnessChannelTransportRequest,
    ctx: HarnessChannelRouteContext,
  ): Promise<ChannelIngressEnvelope>;
  // Same rule as `verifyInbound`: externally reachable action callbacks must
  // be provider-verified before a Harness inbox item can be answered. When the
  // provider exposes the acting user, the adapter returns that verified actor
  // in `ChannelActionEnvelope.actor`; deployment-owned action-token audience
  // policies in §14.5 fail closed if the adapter cannot provide the actor
  // identity needed to evaluate them.
  verifyAction?(
    request: HarnessChannelTransportRequest,
    ctx: HarnessChannelRouteContext,
  ): Promise<ChannelActionEnvelope>;
  // Adapter-wide fallback for operation-specific delivery plans. Default:
  // 'at-least-once'. This is not the only semantics source; every outbox row
  // snapshots the resolved operation and delivery semantics before enqueue.
  deliverySemantics?: ChannelDeliverySemantics;
  // Optional static defaults by provider operation kind. Kinds not listed fall
  // back to `deliverySemantics`, then to 'at-least-once'.
  deliverySemanticsByOperation?: Partial<Record<ChannelOutboxOperationKind, ChannelDeliverySemantics>>;
  // Resolves the provider operation and retry semantics for a candidate outbox
  // item before it is written. If omitted, the bridge uses trusted enqueue
  // operation fields plus `deliverySemanticsByOperation` / `deliverySemantics`.
  resolveDeliveryPlan?(
    item: ChannelOutboxEnqueueOptions,
    ctx: HarnessChannelDeliveryContext,
  ): Promise<ChannelOutboxDeliveryPlan> | ChannelOutboxDeliveryPlan;
  // Required for any delivered row whose snapshotted `deliverySemantics` is
  // `lookup-reconcile`. Called before a retry that might otherwise duplicate a
  // provider-visible operation. `delivered: false` means the adapter
  // authoritatively proved the operation was not delivered; transient,
  // unsupported, or ambiguous lookup results must fail instead of being
  // collapsed into false.
  reconcileDelivery?(item: ChannelOutboxItem, ctx: HarnessChannelDeliveryContext): Promise<{
    delivered: boolean;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }>;
  // Must be rehydratable from `item`, `ctx.binding`, and registered provider
  // configuration. Implementations may construct a short-lived SDK client or
  // thread handle from durable target IDs, but must not require a live
  // AgentStream, SDK Thread instance, webhook request/response, or process-local
  // handler closure.
  deliver(item: ChannelOutboxItem, ctx: HarnessChannelDeliveryContext): Promise<{
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }>;
}

interface HarnessChannelRouteContext {
  harnessName: string;
  channelId: string;
  providerId: string;
  platform: string;
  provider: ChannelProvider;
  route: 'inbound' | 'action';
}

interface HarnessChannelDeliveryContext extends Omit<HarnessChannelRouteContext, 'route'> {
  binding: ChannelBinding;
}

interface ChannelIngressContext extends ChannelIngressEnvelope {
  harnessName: string;
  channelId: string;
  providerId: string;
}

// The registry route context is authoritative for harness/channel/provider
// identity. If a provider payload carries its own harness/channel fields, the
// adapter must ignore them unless they match the route context.
interface ChannelIngressEnvelope {
  platform: string;
  conversationKind: 'dm' | 'group-dm' | 'channel' | 'thread';
  trigger: 'message' | 'mention' | 'subscribed-message' | 'command';
  externalTenantId?: string;
  externalChannelId?: string;
  externalThreadId: string;
  externalMessageId: string;
  content: string;
  actor?: ChannelRequestContext['actor'];
  files?: FileAttachment[];
  receivedAt: number;
  raw?: unknown;                     // adapter-boundary data only; never persisted or hashed
}

// Adapters must return canonical, provider-verified external identifiers
// before `ChannelIngressPolicy` runs. `platform` must match the registry route
// context or the configured channel platform; a payload-provided platform
// string is not trusted. For tenant-scoped platforms, `externalTenantId` is
// required unless the provider's IDs are globally unique and the adapter
// documents that fact. Missing optional identifiers are normalised consistently
// before hashing, binding lookup, or storage uniqueness checks.

interface ChannelActionEnvelope {
  actionId: string;                  // provider retry/idempotency ID
  token: string;                     // provider-visible token string or opaque handle
  // Candidate provider response. The bridge validates or normalizes this to
  // `JsonValue` before computing `responseHash` or writing a durable
  // `ChannelActionReceipt`; `raw` remains adapter-boundary data only.
  response: unknown;
  actor?: ChannelRequestContext['actor']; // provider-verified actor who performed the action
  raw?: unknown;                     // adapter-boundary data only; never persisted or hashed
}

```
