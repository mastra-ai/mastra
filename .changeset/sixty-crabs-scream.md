---
'@mastra/core': minor
---

Added an optional `user` argument to dynamic configuration callbacks. When server authentication is configured, callbacks for `instructions`, `model`, `tools`, `memory`, and other dynamic options receive the authenticated end user normalized to a stable `MastraUser` shape (`id`, `name?`, `email?`, `avatarUrl?`, `role?`), so you can personalize agents without reading auth keys from `requestContext` yourself.

```ts
export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  model: 'openai/gpt-5-mini',
  instructions: ({ user }) => (user ? `You are helping ${user.name ?? user.id}.` : 'You are a helpful assistant.'),
});
```

`user` is `undefined` for unauthenticated requests. Auth providers can override the new `toMastraUser()` method to control how their user objects are normalized.

Workflow resume, restart and time travel no longer restore the authenticated user, roles and permissions saved with the run. They come from the request doing the resuming, so a resume without a signed-in user can't act as the user who started the run. Integrations that build their own resume context can use the new `withoutLiveRequestKeys()` helper from `@mastra/core/request-context` to drop the same keys.
