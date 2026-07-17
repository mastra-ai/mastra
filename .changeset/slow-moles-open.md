---
'@mastra/core': minor
'@mastra/code-sdk': minor
---

Added access to the workspace resolved for an AgentController session.

Use the session-owned workspace when an operation must remain isolated to that session:

```ts
const session = await controller.createSession({ resourceId, scope });
const workspace = session.getWorkspace();
```

Mastra Code workspace resolvers can now accept an isolated read-only skill extension:

```ts
const workspace = await getDynamicWorkspace({
  requestContext,
  skillExtension: {
    id: 'review-skills',
    paths: ['/__review_skills__'],
    createSource: fallback => new ReviewSkillSource(fallback),
  },
});
```

This lets SDK consumers compose additional read-only skill roots into selected workspaces without changing the default workspace skill set.
