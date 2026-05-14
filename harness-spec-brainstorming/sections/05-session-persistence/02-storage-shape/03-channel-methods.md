### 5.2c Channel Methods

Orientation diagram (interface grouping only; the TypeScript signatures below
remain authoritative for arguments, return shapes, and per-method invariants):

<figure>
  <svg role="img" aria-labelledby="hx-channel-methods-title hx-channel-methods-desc" viewBox="0 0 1040 520" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-channel-methods-title">Channel and wakeup storage method families</title>
    <desc id="hx-channel-methods-desc">Channel binding, provider callback binding, and action token methods are declarative-storage operations. Channel inbox, outbox, action receipt, and wakeup methods share a claim-with-TTL, renew, and terminal-update worker pattern.</desc>
    <defs>
      <marker id="ah-channel-methods" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="24" width="960" height="56" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="50" text-anchor="middle">HarnessStorageDomain — channel and wakeup methods</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="70" text-anchor="middle">harness-scoped storage view; the harness layer applies resource/session checks before returning rows</text>

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="106">Declarative-storage methods (no worker claim)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="120" width="280" height="110" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="180" y="148" text-anchor="middle">ChannelBinding ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="180" y="172" text-anchor="middle">save · load · resolve</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="180" y="190" text-anchor="middle">listForSession · listActiveForScope</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="180" y="208" text-anchor="middle">delete</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="340" y="120" width="320" height="110" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="500" y="148" text-anchor="middle">ProviderCallbackBinding ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="500" y="172" text-anchor="middle">resolve · load · loadBySelector</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="500" y="190" text-anchor="middle">listForHarness · markStatus</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="500" y="208" text-anchor="middle">delete</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="680" y="120" width="320" height="110" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="840" y="148" text-anchor="middle">ChannelActionToken ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="840" y="172" text-anchor="middle">createOrLoad · loadById</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="840" y="190" text-anchor="middle">loadByTransportHash · loadForPendingItem</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="840" y="208" text-anchor="middle">revoke (non-claimable)</text>

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="260">Claim-fenced worker methods (createOrLoad → claim → renew → update)</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="274" width="230" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="302" text-anchor="middle">ChannelInboxItem ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="326" text-anchor="middle">save · createOrLoad</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="344" text-anchor="middle">loadByIdempotencyKey</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="362" text-anchor="middle">claim · renew · update</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="290" y="274" width="230" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="405" y="302" text-anchor="middle">ChannelOutboxItem ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="405" y="326" text-anchor="middle">enqueue · claim · renew</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="405" y="344" text-anchor="middle">markSent · markFailed</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="405" y="362" text-anchor="middle">(per-binding head-of-line)</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="540" y="274" width="230" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="302" text-anchor="middle">ChannelActionReceipt ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="326" text-anchor="middle">save · createOrLoad</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="344" text-anchor="middle">loadByActionId · loadByTokenId</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="362" text-anchor="middle">claim · renew · update</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="790" y="274" width="210" height="120" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="895" y="302" text-anchor="middle">HarnessWakeupItem ops</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="326" text-anchor="middle">createOrLoad · claim</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="344" text-anchor="middle">renew · update</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="362" text-anchor="middle">(scheduled/proactive sources)</text>

    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-channel-methods);" d="M180 230 L155 273" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-channel-methods);" d="M180 230 L400 273" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-channel-methods);" d="M840 230 L660 273" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="170" y="252">bindingId / generation</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="690" y="252">actionTokenId</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="40" y="424" width="960" height="76" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="450" text-anchor="middle">Shared claim pattern</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="472" text-anchor="middle">idempotent createOrLoad/enqueue · claim with TTL · renew while delivering · terminal update under claim fence</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="520" y="490" text-anchor="middle">retry, claim renewal, clock-skew, batch size, and dead-letter thresholds come from §9 channel/wakeup config</text>
  </svg>
  <figcaption>Declarative storage methods configure routing and prompt anchors; worker methods share the claim-renew-update pattern that recovers in-flight inbox, outbox, action receipt, and wakeup work.</figcaption>
</figure>

```ts
    // Channel bridge records (new in v1). These are storage-level primitives;
    // the harness storage view scopes them by `harnessName`, and the harness
    // layer applies resource/session checks before returning them to callers.
    // Idempotent saves use provider event IDs and outbox delivery keys so webhook
    // retries and dispatcher retries are safe.
    saveChannelBinding(record: ChannelBinding): Promise<void>;
    loadChannelBinding(opts: { bindingId: string }): Promise<ChannelBinding | null>;
    loadChannelBindingByExternal(opts: {
      harnessName: string;
      channelId: string;
      platform: string;
      externalTenantId?: string;
      externalChannelId?: string;
      externalThreadId: string;
    }): Promise<ChannelBinding | null>;
    resolveChannelBinding(opts: {
      candidate: ChannelBinding;
      replaceBindingId?: string;
    }): Promise<{ binding: ChannelBinding; created: boolean; replacedBindingId?: string }>;
    listChannelBindingsForSession(opts: { sessionId: string }): Promise<ChannelBinding[]>;
    listActiveChannelBindingsForScope(opts: {
      harnessName: string;
      channelId?: string;
      limit: number;
      cursor?: string;
    }): Promise<{ bindings: ChannelBinding[]; nextCursor?: string }>;
    deleteChannelBinding(opts: { bindingId: string }): Promise<void>;

    // Provider callback bindings (new in v1). These map provider installations
    // and routes to harness/channel pairs for callback routing. They are
    // configuration-level records, not claimable work rows. Registration
    // changes at provisioning time or through operator tools, not during
    // normal callback processing.
    resolveProviderCallbackBinding(opts: {
      candidate: HarnessProviderCallbackBinding;
      replaceBindingId?: string;
    }): Promise<{
      binding: HarnessProviderCallbackBinding;
      created: boolean;
      conflict: boolean;
      replacedBindingId?: string;
    }>;
    loadProviderCallbackBinding(opts: { bindingId: string }): Promise<HarnessProviderCallbackBinding | null>;
    loadProviderCallbackBindingBySelector(opts: {
      providerId: string;
      selectorKind: 'installation' | 'route-key' | 'external-tenant';
      selectorValue: string;
    }): Promise<HarnessProviderCallbackBinding | null>;
    listProviderCallbackBindingsForHarness(opts: {
      harnessName: string;
      channelId?: string;
      status?: HarnessProviderCallbackBinding['status'][];
      limit?: number;
      cursor?: string;
    }): Promise<{ bindings: HarnessProviderCallbackBinding[]; nextCursor?: string }>;
    markProviderCallbackBindingStatus(opts: {
      bindingId: string;
      status: HarnessProviderCallbackBinding['status'];
      undeliverableReason?: string;
    }): Promise<void>;
    deleteProviderCallbackBinding(opts: { bindingId: string }): Promise<void>;

    saveChannelInboxItem(record: ChannelInboxItem): Promise<void>;
    createOrLoadChannelInboxItem(record: ChannelInboxItem, opts?: {
      initialClaim?: { claimId: string; now: number; claimTtlMs: number };
    }): Promise<{
      item: ChannelInboxItem;
      duplicate: boolean;
      conflict: boolean;
      claimed: boolean;
    }>;
    loadChannelInboxItemByIdempotencyKey(opts: {
      harnessName: string;
      channelId: string;
      idempotencyKey: string;
    }): Promise<ChannelInboxItem | null>;
    claimChannelInboxItems(opts: {
      harnessName: string;
      channelId?: string;
      statuses: Array<'received' | 'admitted' | 'failed'>;
      claimId: string;
      limit: number;
      now: number;
      claimTtlMs: number;
    }): Promise<ChannelInboxItem[]>;
    renewChannelInboxClaim(opts: {
      inboxItemId: string;
      claimId: string;
      now: number;
      claimTtlMs: number;
    }): Promise<{ claimExpiresAt: number; storageNow: number }>;
    // Applies legal inbox state transitions such as received->admitted,
    // admitted->accepted/queued, retryable failure, or dead-letter. This is a
    // compare-and-set update, not a blind overwrite; after the initial durable
    // receipt exists, callers must hold the matching claim.
    updateChannelInboxItem(record: ChannelInboxItem, opts: { claimId: string }): Promise<void>;

    createOrLoadChannelActionToken(record: ChannelActionToken): Promise<{
      token: ChannelActionToken;
      duplicate: boolean;
      conflict: boolean;
    }>;
    loadChannelActionTokenById(opts: {
      harnessName: string;
      channelId: string;
      actionTokenId: string;
    }): Promise<ChannelActionToken | null>;
    loadChannelActionTokenByTransportHash(opts: {
      harnessName: string;
      channelId: string;
      transportHash: string;
    }): Promise<ChannelActionToken | null>;
    loadChannelActionTokenForPendingItem(opts: {
      harnessName: string;
      channelId: string;
      bindingId: string;
      bindingGeneration: number;
      owningSessionId: string;
      itemId: string;
      kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
      runId: string;
      pendingRequestedAt: number;
      metadataHash: string;
    }): Promise<ChannelActionToken | null>;
    revokeChannelActionToken(opts: {
      harnessName: string;
      channelId: string;
      actionTokenId: string;
      revokedAt?: number;
      revokedReason?: string;
    }): Promise<ChannelActionToken>;

    saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void>;
    createOrLoadChannelActionReceipt(record: ChannelActionReceipt, opts?: {
      initialClaim?: { claimId: string; now: number; claimTtlMs: number };
    }): Promise<{
      receipt: ChannelActionReceipt;
      duplicate: boolean;
      conflict: boolean;
      claimed: boolean;
    }>;
    loadChannelActionReceiptByActionId(opts: {
      harnessName: string;
      channelId: string;
      actionId: string;
    }): Promise<ChannelActionReceipt | null>;
    loadChannelActionReceiptByTokenId(opts: {
      harnessName: string;
      channelId: string;
      actionTokenId: string;
    }): Promise<ChannelActionReceipt | null>;
    claimChannelActionReceipts(opts: {
      harnessName: string;
      channelId?: string;
      statuses: Array<'received' | 'accepted' | 'failed'>;
      claimId: string;
      limit: number;
      now: number;
      claimTtlMs: number;
    }): Promise<ChannelActionReceipt[]>;
    renewChannelActionReceiptClaim(opts: {
      receiptId: string;
      claimId: string;
      now: number;
      claimTtlMs: number;
    }): Promise<{ claimExpiresAt: number; storageNow: number }>;
    // Applies legal receipt transitions such as received->accepted,
    // accepted->applied, received/accepted/failed->failed with retry, conflict,
    // or dead-letter. This is a compare-and-set update guarded by the receipt
    // claim once processing has begun.
    updateChannelActionReceipt(record: ChannelActionReceipt, opts: { claimId: string }): Promise<void>;

    enqueueChannelOutbox(record: ChannelOutboxItem): Promise<{
      outboxItemId: string;
      duplicate: boolean;
      conflict: boolean;
    }>;
    claimChannelOutbox(opts: {
      harnessName: string;
      channelId?: string;
      claimId: string;
      limit: number;
      now: number;
      claimTtlMs: number;
    }): Promise<ChannelOutboxItem[]>;
    renewChannelOutboxClaim(opts: {
      outboxItemId: string;
      claimId: string;
      now: number;
      claimTtlMs: number;
    }): Promise<{ claimExpiresAt: number; storageNow: number }>;
    markChannelOutboxSent(opts: {
      outboxItemId: string;
      claimId: string;
      sentAt?: number;
      providerMessageId?: string;
      providerReceipt?: ChannelProviderDeliveryReceipt;
    }): Promise<void>;
    markChannelOutboxFailed(opts: {
      outboxItemId: string;
      claimId: string;
      retryAt?: number;
      dead?: boolean;
      error: { code: string; message: string };
    }): Promise<void>;

    createOrLoadHarnessWakeupItem(record: HarnessWakeupItem, opts?: {
      initialClaim?: { claimId: string; now: number; claimTtlMs: number };
    }): Promise<{
      item: HarnessWakeupItem;
      duplicate: boolean;
      conflict: boolean;
      claimed: boolean;
    }>;
    claimHarnessWakeupItems(opts: {
      harnessName: string;
      source?: 'schedule' | 'proactive';
      statuses: Array<'due' | 'failed' | 'claimed'>;
      claimId: string;
      limit: number;
      now: number;
      claimTtlMs: number;
    }): Promise<HarnessWakeupItem[]>;
    renewHarnessWakeupClaim(opts: {
      wakeupItemId: string;
      claimId: string;
      now: number;
      claimTtlMs: number;
    }): Promise<{ claimExpiresAt: number; storageNow: number }>;
    updateHarnessWakeupItem(record: HarnessWakeupItem, opts: { claimId: string }): Promise<void>;

```
