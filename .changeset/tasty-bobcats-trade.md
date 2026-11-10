---
'@mastra/factory': minor
---

Removed the `source_control_publish_test_check` session tool and the per-project `reviewTestChecksEnabled` setting that gated it. Factory's review skills now report test results only in their `## Factory test report` comment. An app that wants a commit check passes its own tool through `tools` and builds it on the new `factory.reviewedChangeRequest(requestContext)`. That returns the change request a Review run reviews (provider, repository, number, current head and branch), or `undefined` outside a Review run. Its `publishCommitCheck()` refuses a head that moved, a closed change request, and a provider that cannot publish commit checks.

`platformConnectTools(projectId)` is now exported, so an app passing `tools` can keep the Mastra Connect tools Factory offers by default.

`FactoryProject` no longer has `reviewTestChecksEnabled`, and `FactoryProjectsStorage.update` no longer accepts it. `PATCH /web/factory/projects/:id` still accepts it for one more release and ignores it.

**Before**

```ts
await projects.update({ orgId, id, input: { autoRunEnabled: true, reviewTestChecksEnabled: true } });
// A review skill called source_control_publish_test_check.
```

**After**

```ts
await projects.update({ orgId, id, input: { autoRunEnabled: true } });

const factory: MastraFactory = new MastraFactory({
  // ...
  tools: async ({ requestContext }) => ({
    ...(await platformConnectTools(process.env.MASTRA_PROJECT_ID!)({ requestContext })),
    publish_test_check: createTool({
      id: 'publish_test_check',
      inputSchema: z.object({ headSha: z.string(), status: z.enum(['success', 'failure']), summary: z.string() }),
      execute: async (input, { requestContext }) => {
        const reviewed = await factory.reviewedChangeRequest(requestContext!);
        if (!reviewed) throw new Error('Only a Review run can publish a test check.');
        return reviewed.publishCommitCheck({ ...input, name: 'Review / tests', title: input.summary });
      },
    }),
  }),
});
```

Call your tool from your own review skill.
