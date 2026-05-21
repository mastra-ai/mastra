---
'@mastra/slack': minor
---

Improved Slack channel UX:

- **Flat adapter config** — `SlackProvider` now accepts per-adapter options (`formatError`, `streaming`, `typingStatus`, `toolDisplay`) directly at the top level instead of nesting under `adapterConfig`. The `adapterConfig` field still works as a deprecated fallback.
- **Breaking change** — the `cards: boolean` and `formatToolCall` fields have been removed from `SlackProviderConfig`/`SlackAdapterChannelConfig`. Migrate `cards: false` → `toolDisplay: 'text'`, and `formatToolCall: (info) => msg` → `toolDisplay: (event) => event.kind === 'result' ? { kind: 'post', message: msg } : undefined`.
- **Opinionated defaults** — `SlackProvider` now defaults `streaming: true` and `toolDisplay: 'grouped'` since the grouped "Thinking Steps" widget renders well in Slack's AI Assistant UI. Override either per-config to restore other modes.
- **AI Assistant manifest** — `assistant:write` is now part of `DEFAULT_BOT_SCOPES` and the generated manifest declares the matching `assistant_view` feature, so newly generated app manifests support the AI Assistant surface and thread context in DMs.
- **Slack DM tool-approval routing** — clicks on tool-approval cards in Slack DMs now resume the correct Mastra thread.

```ts
import { SlackProvider } from '@mastra/slack';

const slack = new SlackProvider({
  // Top-level options (preferred):
  streaming: true,
  toolDisplay: 'grouped', // or 'cards' | 'text' | 'timeline' | 'hidden' | ToolDisplayFn
});
```
