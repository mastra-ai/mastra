---
"@mastra/playground-ui": patch
---

Fix Studio crash when loading a browser agent thread containing `system-reminder` messages.

`signal`-role messages (e.g. browser context reminders from `@mastra/agent-browser`) are now filtered out before being passed to the chat renderer. Previously these caused a React crash because `@assistant-ui/react` only accepts `user`, `assistant`, and `system` roles.

```typescript
// Before: Studio crashed with
// "Unknown message role: signal" or
// "System messages must have exactly one text message part"

// After: signal-role messages are silently filtered — the agent page
// loads correctly and existing threads remain usable
```
