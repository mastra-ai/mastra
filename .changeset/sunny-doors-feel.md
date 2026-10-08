---
'@mastra/factory': minor
---

Factory environments keep one sandbox template between builds and rebuild it on triggers.

- Sessions pin to the repository heads recorded on the last build, so a template no longer changes with every commit on a base branch.
- A build worker rebuilds on a template-affecting environment change, on the new `POST /web/factory/projects/:id/environment/build` route (Build now), on a push to an environment repository's base branch (leading-edge debounce), and on a schedule that first checks whether any head moved.
- Builds record the template id, heads and per-repository status; failures record the error and back off. One build runs per Factory at a time, bounded at 30 minutes.
- The environment `GET`/`PATCH` payloads gain `buildTriggers` and `build`; `PATCH` returns `buildRequested` when a change queued a build.
- Push triggers need the platform GitHub polling worker or the self-hosted webhook.

Hosts opt in by returning the template resolver they already hand to `PlatformSandbox`:

```ts
new MastraFactory({
  sandbox: ctx => new PlatformSandbox({ id: ctx.sandboxId, template: createPlatformRepoTemplate(ctx) }),
  sandboxTemplate: ctx => createPlatformRepoTemplate(ctx),
});
```

Without `sandboxTemplate`, environments keep building lazily on the first session.
