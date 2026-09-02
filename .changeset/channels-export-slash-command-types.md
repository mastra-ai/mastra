---
'@mastra/core': patch
---

Fixed `SlashCommandChannelHandler`, `SlashCommandChannelHandlerConfig`, and `SlashCommandEvent` not being exported from `@mastra/core/channels`. Standalone slash-command handlers can now be typed directly instead of reaching through `ChannelHandlers['onSlashCommand']`.

```ts
import type { SlashCommandChannelHandler } from '@mastra/core/channels';

const onSlashCommand: SlashCommandChannelHandler = async (event, defaultHandler) => {
  if (event.command === '/help') {
    await event.channel.post('Available commands: /help');
    return;
  }
  await defaultHandler();
};
```
