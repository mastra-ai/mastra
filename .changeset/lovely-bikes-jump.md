---
'@mastra/factory': minor
---

Added per-event rules to GithubIntegration and PlatformGithubIntegration so each installation owns its GitHub behavior. Functions replace defaults, null disables an event handler, and omitted or undefined values retain defaults. Removed global GitHub rule configuration; migrate rules.github[event].onEvent to the integration constructor rules[event].

```typescript
// Before: global Factory overrides
const overrides = { github: { issueCommentCreated: { onEvent: null } } };

// After: integration constructor
const github = new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
```
