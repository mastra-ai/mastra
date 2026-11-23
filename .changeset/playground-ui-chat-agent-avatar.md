---
'@mastra/playground-ui': patch
---

Agent chat can show the agent's avatar on the empty-thread welcome. Pass `agentAvatarUrl` to `AgentChat` (or `AgentThreadPage`'s `chat` props); without it the agent's initial is shown as before.

```tsx
<AgentThreadPage chat={{ agentName: agent.name, agentAvatarUrl: agent.metadata?.avatarUrl }} />
```
