### 14.3 Request Context

Channel metadata is attached to the turn as `requestContext.channel` and is
exposed to tools on `HarnessRequestContext.channel` (§6.1).

```ts
type ChannelRequestContext =
  | InboundChannelRequestContext
  | BindingBackedChannelRequestContext;

interface BaseChannelRequestContext {
  harnessName: string;
  channelId: string;                 // registered Harness channel key
  providerId: string;                // registered Mastra ChannelProvider key
  platform: string;                  // e.g. 'slack', 'discord', 'teams'
  conversationKind?: 'dm' | 'group-dm' | 'channel' | 'thread';
  trigger?: 'message' | 'mention' | 'subscribed-message' | 'command';
  externalTenantId?: string;         // workspace / guild / org, if the platform has one
  externalChannelId?: string;        // platform room/channel/DM identifier
  externalThreadId: string;          // platform thread/conversation identifier
  replyToMessageId?: string;
  actor?: {
    externalUserId: string;
    displayName?: string;
    linkedResourceId?: string;       // set only after app-level identity linking
  };
  capabilities?: {
    markdown?: boolean;
    buttons?: boolean;
    files?: boolean;
    edits?: boolean;
    reactions?: boolean;
  };
}

interface InboundChannelRequestContext extends BaseChannelRequestContext {
  origin: 'inbound';
  bindingId?: string;                // present once the provider event resolves a ChannelBinding
  externalMessageId: string;         // inbound platform message/event ID
}

interface BindingBackedChannelRequestContext extends BaseChannelRequestContext {
  origin: 'scheduled' | 'proactive';
  bindingId: string;                 // active ChannelBinding used for delivery/replies
  externalMessageId?: never;
}
```

This metadata is descriptive. It never overrides the Harness identity fields.
Tools may use it to tailor emitted progress or ask-user prompts, but tools must
not call platform APIs directly for user-visible delivery; §6.3 defines the
enforcement boundary for arbitrary in-process tool code versus Harness-owned
capability surfaces. Durable outbound goes through the outbox.

Inbound channel turns populate `conversationKind`, `trigger`, and
`externalMessageId` from the verified ingress envelope. Scheduled or proactive
channel-origin turns are binding-backed: before queue admission the wakeup or
trusted integration must load an active `ChannelBinding`, validate the expected
generation when one was snapshotted, set `bindingId`, and copy the binding's
platform target identifiers into `requestContext.channel`. They may omit
`conversationKind` and `trigger` when no provider event caused the work. If no
active binding exists, the work is not channel-origin delivery: it either queues
without `requestContext.channel` under an application policy that accepts no
channel outbox projection, or the owning wakeup/work row remains retryable,
skipped, failed, or dead according to its policy.
