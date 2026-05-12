### 5.1h Channel Records

Orientation diagram (record relationships only; the TypeScript shapes below
remain the authoritative field inventory):

<figure>
  <svg role="img" aria-labelledby="hx-channel-records-title hx-channel-records-desc" viewBox="0 0 1040 540" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-channel-records-title">Channel bridge record families</title>
    <desc id="hx-channel-records-desc">HarnessProviderCallbackBinding routes provider callbacks to a harness/channel pair. ChannelBinding anchors a per-conversation binding generation. ChannelInboxItem, ChannelOutboxItem, ChannelActionToken, and ChannelActionReceipt are the per-conversation work rows.</desc>
    <defs>
      <marker id="ah-channel-records" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="30" width="380" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="230" y="62" text-anchor="middle">HarnessProviderCallbackBinding</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="230" y="85" text-anchor="middle">installation / route-key / external-tenant → harness + channel</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="540" y="30" width="460" height="80" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="770" y="58" text-anchor="middle">Channel registry route context</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="770" y="82" text-anchor="middle">harnessName + channelId + providerId from §9 config / §13 routes</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="770" y="100" text-anchor="middle">(not a §5.1 row; included for orientation)</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="340" y="170" width="360" height="80" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="201" text-anchor="middle">ChannelBinding</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="224" text-anchor="middle">per-conversation binding + generation</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-records);" d="M230 110 C320 145 420 165 470 169" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 6 6;" d="M770 110 L580 169" />

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="310" width="220" height="90" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="342" text-anchor="middle">ChannelInboxItem</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="366" text-anchor="middle">provider intake</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="150" y="386" text-anchor="middle">received → admitted → accepted/queued</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="290" y="310" width="220" height="90" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="342" text-anchor="middle">ChannelOutboxItem</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="366" text-anchor="middle">provider delivery</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="400" y="386" text-anchor="middle">pending → claimed → sent / failed / dead</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="540" y="310" width="220" height="90" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="650" y="342" text-anchor="middle">ChannelActionToken</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="650" y="366" text-anchor="middle">prompt anchor (non-claimable)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="650" y="386" text-anchor="middle">audience policy + transport hash</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="790" y="310" width="220" height="90" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="900" y="342" text-anchor="middle">ChannelActionReceipt</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="900" y="366" text-anchor="middle">first response wins</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="900" y="386" text-anchor="middle">received → accepted → applied / conflict / dead</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-records);" d="M420 250 L210 309" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-records);" d="M490 250 L420 309" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-records);" d="M555 250 L640 309" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-channel-records);" d="M620 250 L890 309" />

    <path style="stroke: #475569; stroke-width: 1.8; fill: none; marker-end: url(#ah-channel-records);" d="M760 355 L789 355" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="755" y="345">callback</text>

    <rect style="fill: none; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="20" y="290" width="1000" height="124" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="30" y="305">per-conversation work rows (claimable except for the token anchor)</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="40" y="450" width="950" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="515" y="478" text-anchor="middle">Workers claim and renew the inbox, outbox, and receipt rows under TTL; the token row is never claimed.</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="515" y="500" text-anchor="middle">Inbox/Outbox/Receipt carry bindingId + bindingGeneration; binding replacement fences stale rows rather than retargeting them.</text>
  </svg>
  <figcaption>Provider callbacks resolve through the callback-binding row to a per-conversation ChannelBinding; the four work rows hang off that binding with separate state machines and claim semantics.</figcaption>
</figure>

```ts
// Channel bridge records live in the harness storage domain next to sessions.
// They are separate records instead of fields on SessionRecord because channel
// dispatch workers must be able to claim and update delivery state without
// becoming second writers to the session lease (§5.8). See §14.

type ChannelBindingMode = 'per-user-resource' | 'thread-resource' | 'shared-resource';

interface ChannelBinding {
  id: string;
  harnessName: string;
  channelId: string;                  // registered Harness channel key
  providerId: string;                  // registered Mastra ChannelProvider key used for delivery
  status: 'active' | 'replaced' | 'closed' | 'undeliverable';
  platform: string;                    // e.g. 'slack', 'discord', 'teams'
  externalTenantId?: string;           // workspace / guild / org
  externalChannelId?: string;          // room/channel/DM identifier
  externalThreadId: string;            // platform thread/conversation identifier
  resourceId: string;
  threadId: string;
  sessionId: string;
  mode: ChannelBindingMode;             // resource-resolution mode, not platform conversation kind
  generation: number;                  // starts at 1; increments on replacement
  createdAt: number;
  updatedAt: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  closedAt?: number;
  // Subset of `HarnessRowErrorCode` (§4.5d). `delivery_operation_unavailable`
  // is intentionally absent: outbox delivery unavailability dead-letters one
  // row and never closes the binding (§14.4). Wire surfaces project these
  // codes through §13.3f.1: cascade closures map to
  // `harness.session_closed` / `harness.session_deleted`; binding-local
  // closures map to `harness.channel_binding_closed` with `details.reason`
  // discriminating `platform_unlinked` / `operator_closed`.
  closedReason?: Extract<
    HarnessRowErrorCode,
    'session_closed' | 'session_deleted' | 'platform_unlinked' | 'operator_closed'
  >;
  replacedByBindingId?: string;
  undeliverableReason?: string;
}

// Provider callback bindings are durable installation/route→harness mappings.
// They let the registry resolve provider-owned callbacks to the correct
// harness/channel pair before a per-conversation ChannelBinding exists. They
// are configuration-level records, not claimable work rows.
type HarnessProviderCallbackBindingStatus = 'active' | 'disabled' | 'replaced' | 'undeliverable';

interface HarnessProviderCallbackBinding {
  id: string;
  providerId: string;                // Mastra channels registration key, not platform type ID
  selectorKind: 'installation' | 'route-key' | 'external-tenant';
  selectorValue: string;             // canonical normalized key
  harnessName: string;
  channelId: string;                 // registered Harness channel key
  status: HarnessProviderCallbackBindingStatus;
  origin?: 'provisioned' | 'migrated';
  migratedFrom?: { owner: 'agentchannels'; agentId?: string; installationId?: string };
  migratedAt?: number;
  replacedByBindingId?: string;
  undeliverableReason?: string;
  environment?: string;              // audit metadata, not part of uniqueness key
  metadata?: Record<string, JsonValue>;
  createdAt: number;
  updatedAt: number;
}

interface ChannelInboxItem {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  idempotencyKey: string;            // unique provider event/message ID for this channel
  payloadHash: string;               // stable hash of normalized content/files/context
  admissionHash?: string;            // stable hash of persisted session admission payload
  admissionId: string;               // passed to `message` / `queue` for de-dupe
  bindingId?: string;
  resourceId?: string;
  threadId?: string;
  sessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  externalMessageId: string;
  receivedAt: number;
  admittedAt?: number;
  acceptedAt?: number;
  queuedAt?: number;
  failedAt?: number;
  deadAt?: number;
  updatedAt: number;
  status: 'received' | 'admitted' | 'accepted' | 'queued' | 'failed' | 'dead';
  delivery?: 'message' | 'queue';    // required before admitted->accepted/queued
  // Trusted channel policy may choose per-turn mode/model overrides. These
  // are persisted before admission, replayed unchanged on retries as
  // ordinary `message` / `queue` overrides, and never mutate session
  // defaults. Provider payload fields do not set them directly.
  mode?: string;
  model?: string;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  requestContext: PersistedRequestContextInput;
  content: string;
  attachments: PersistedAttachment[];
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
}

interface ChannelProviderDeliveryReceipt {
  providerMessageId?: string;
  providerThreadId?: string;
  deliveryId?: string;
  metadata?: JsonValue;             // adapter-normalized provider acknowledgement safe to persist
}

interface ChannelOutboxItem {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  bindingId: string;                // delivery binding / platform target
  bindingGeneration: number;         // generation loaded when item was enqueued
  idempotencyKey: string;
  payloadHash: string;
  resourceId: string;
  threadId: string;
  sessionId: string;                // delivery session from the binding
  owningSessionId: string;          // session that produced/owns the item
  source?: 'parent' | 'subagent';
  target: {
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  };
  kind: 'assistant-message' | 'message-edit' | 'inbox-prompt' | 'inbox-resolution' | 'status' | 'tool-result' | 'reaction' | 'custom';
  operationKind: ChannelOutboxOperationKind;
  operationName?: string;
  payload: JsonValue;                // adapter-owned JSON payload
  deliverySemantics: ChannelDeliverySemantics;
  status: 'pending' | 'claimed' | 'sent' | 'failed' | 'dead';
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  sentAt?: number;
  providerMessageId?: string;
  providerReceipt?: ChannelProviderDeliveryReceipt;
  lastError?: { code: HarnessRowErrorCode; message: string };
  createdAt: number;
  updatedAt: number;
}

interface ChannelActionToken {
  actionTokenId: string;             // deterministic prompt/action group ID; stable for every control that answers this pending item
  harnessName: string;
  channelId: string;
  providerId: string;
  resourceId: string;
  owningSessionId: string;
  itemId: string;                    // stable pending interaction ID
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  bindingId: string;                 // delivery binding used by the rendered prompt
  bindingGeneration: number;
  runId: string;                     // pending item's runId, used to reject stale tokens
  pendingRequestedAt: number;        // pending item's requestedAt, used to reject itemId reuse
  audience: ChannelActionAudience;    // JSON-safe deployment policy snapshot for first use
  metadataHash: string;              // canonical hash of immutable token metadata, including audience
  transportHash: string;             // canonical hash of the rendered token string/handle
  keyId?: string;                    // signing or verification profile for stable re-rendering
  expiresAt?: number;
  revokedAt?: number;
  // Subset of `HarnessRowErrorCode` (§4.5d). Force-delete cascade writes
  // `'session_deleted'` per §5.5; future operator/expiry paths may extend
  // this subset, governed by §11.6's literal-set rule. Wire surfaces project
  // through §13.3f.1.
  revokedReason?: Extract<HarnessRowErrorCode, 'session_deleted'>;
  createdAt: number;
  updatedAt: number;
}

interface ChannelActionReceipt {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  actionTokenId: string;            // Harness prompt/action group ID; first response wins
  actionId: string;                 // provider retry/idempotency ID for this callback
  bindingId: string;                // delivery binding used by the action card
  bindingGeneration: number;
  resourceId: string;
  owningSessionId: string;
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  runId: string;
  pendingRequestedAt: number;
  audience: ChannelActionAudience;   // copied from the token's JSON-safe policy snapshot
  verifiedActor?: ChannelRequestContext['actor'];
  responseHash: string;             // stable hash of the normalized response
  response: JsonValue;
  status: 'received' | 'accepted' | 'applied' | 'conflict' | 'failed' | 'dead';
  conflictReason?:
    | 'response_mismatch'
    | 'stale_item'
    | 'kind_mismatch'
    | 'run_mismatch'
    | 'binding_mismatch'
    | 'session_closed'
    | 'actor_not_allowed'
    | 'token_expired'
    | 'token_revoked';
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  acceptedAt?: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  result?: ChannelActionResult;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
  createdAt: number;
  updatedAt: number;
}
```
