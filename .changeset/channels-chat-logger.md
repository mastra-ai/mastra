---
'@mastra/core': minor
---

Chat SDK logs from channels now use your Mastra logger, so they follow its format, level, and redact settings. Use the new `toChatLogger` export to send adapter logs to the same logger.

```ts
import { toChatLogger } from '@mastra/core/channels';

const logger = new PinoLogger({ name: 'app', level: 'info' });

createDiscordAdapter({ logger: toChatLogger(logger, { component: 'discord', minLevel: 'warn' }) });
```

Chat SDK warnings and errors now also reach observability log export, like other Mastra logs. Channel logs from `PinoLogger` now have a `component` field in place of stray `0`, `1`, `2` fields.
