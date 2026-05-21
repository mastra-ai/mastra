---
'@mastra/slack': patch
---

Improved Slack channel UX:

- **Flat adapter config** — `SlackProvider` now accepts per-adapter options (`cards`, `formatToolCall`, `formatError`, `streaming`, `typingStatus`, `toolDisplay`) directly at the top level instead of nesting under `adapterConfig`. The `adapterConfig` field still works as a deprecated fallback.
- **Opinionated defaults** — `SlackProvider` now defaults `streaming: true`, `toolDisplay: 'grouped'`, and `typingStatus: false` since the grouped "Thinking Steps" widget renders well in Slack's AI Assistant UI and conveys live progress without needing a separate typing indicator. Override any of these per-config to restore other modes.
- **AI Assistant manifest** — `assistant:write` is now part of `DEFAULT_BOT_SCOPES` and the generated manifest declares the matching `assistant_view` feature, so newly generated app manifests support the AI Assistant surface and thread context in DMs.
- **Slack DM tool-approval routing** — clicks on tool-approval cards in Slack DMs now resume the correct Mastra thread.

```ts
import { SlackProvider } from '@mastra/slack';

const slack = new SlackProvider({
  // Top-level options (preferred):
  streaming: true,
  toolDisplay: 'grouped', // or 'cards' | 'timeline' | 'hidden'
  typingStatus: false,
});
```
