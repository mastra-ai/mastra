---
'@mastra/server': minor
'@mastra/core': patch
---

Added `authorizeUserResource` to server auth, next to `mapUserToResourceId`. When a request names a resource other than the caller's mapped one (`resourceId`, `resource_id` or `memory.resource`), the server asks this callback. Return `true` and the request runs under the requested resource, so memory ownership, agent controller sessions and tools see it; any other result gets a 403. It may return a promise. Without it, the mapped resource keeps winning, as before.

```ts
auth: {
  mapUserToResourceId: user => user.id,
  authorizeUserResource: async (user, resourceId) => isSessionMember(user.id, resourceId),
}
```

Agent controller sessions now reject input whose request context belongs to another resource (messages, follow-ups, queued messages, notifications, steering and tool approvals) before anything is queued, stored or delivered.
