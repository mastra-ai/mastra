---
'@mastra/core': minor
---

Added an optional `user` argument to dynamic configuration callbacks. When server authentication is configured, callbacks for `instructions`, `model`, `tools`, `memory`, and other dynamic options receive the authenticated end user normalized to a stable `MastraUser` shape (`id`, `name?`, `email?`, `avatarUrl?`, `role?`), so you can personalize agents without reading auth keys from `requestContext` yourself.

```ts
export const supportAgent = new Agent({
  id: 'support-agent',
  model: 'openai/gpt-5-mini',
  instructions: ({ user }) => (user ? `You are helping ${user.name ?? user.id}.` : 'You are a helpful assistant.'),
});
```

`user` is `undefined` for unauthenticated requests. Auth providers can override the new `toMastraUser()` method to control how their user objects are normalized.
