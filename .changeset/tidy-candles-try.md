---
'@mastra/core': minor
---

Added `consumeStream` and `formatOutboundText` hooks to `channels` for customizing how agent responses are rendered to chat platforms.

Use `formatOutboundText` for light post-processing of each flushed text chunk (for example redacting internal identifiers or suppressing a post by returning an empty string). Use `consumeStream` to fully replace the chunk-rendering loop for streaming edits, batched posts, or platform-specific rendering while keeping the rest of Mastra's channel pipeline — thread mapping, history fetch, attachments, tool approval, webhook routes, and gateway — untouched.

**Why:** Customizing how chunks are posted previously required re-implementing the whole `processChatMessage` body via `handlers.*` overrides. These two hooks expose just the rendering loop so customization no longer re-owns unrelated surface area.

**Before:** tweaking per-chunk output meant overriding the whole message handler.

```ts
channels: {
  adapters: { discord: createDiscordAdapter() },
  handlers: {
    processChatMessage: async ctx => {
      // Re-implement the entire chunk loop, thread mapping, history fetch,
      // attachments, tool approval plumbing, and webhook routing here.
    },
  },
}
```

**After:** the two new hooks expose only the rendering loop.

```ts
channels: {
  adapters: { discord: createDiscordAdapter() },
  formatOutboundText: text => text.replace(/sk_[a-z0-9]+/gi, '[redacted]'),
  consumeStream: async ({ stream, helpers }) => {
    // The first delta posts a new message; subsequent deltas edit it.
    // `helpers.editOrPost` returns the effective message id either way.
    let messageId: string | undefined
    let buffer = ''
    for await (const chunk of stream.fullStream) {
      if (chunk.type !== 'text-delta') continue
      buffer += chunk.payload.text
      messageId = await helpers.editOrPost(messageId, buffer)
    }
  },
}
```

The default renderer is also exported as `defaultConsumeStream` from `@mastra/core/channels` for overrides that prefer to wrap it.

Setting `consumeStream` short-circuits `formatOutboundText` — the override owns all formatting.
