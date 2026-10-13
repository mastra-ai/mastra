---
'@mastra/factory': minor
---

Sessions boot every repository in the Factory environment instead of one linked repository.

- The sandbox template is built from every environment repository, in the order shown on the Environment page. Each is cloned under the workspace root, which becomes the session's working directory.
- The session branch is resumed where the remote has it. A new session branch starts from the latest remote default branch, and local work in an existing checkout is kept.
- A repository's setup command is skipped when the template already ran it, and the workspace setup command runs last.
- A `factory-environment` state signal tells the agent which repositories are present, where, and on which branch.
- Every repository is torn down when the session retires.
- The provider receives the project's stored sandbox settings when a session's sandbox is constructed. Settings saved later apply to sandboxes constructed after that.

```ts
class MyFactorySandbox extends FactorySandbox<{ cpuCount?: number }> {
  readonly provider = 'my-provider';
  readonly settings = z.object({ cpuCount: z.number().int().min(1).optional() });

  create(ctx: FactorySandboxContext, settings: { cpuCount?: number }) {
    // ctx.repos lists every environment repository; ctx.workingDirectory is the workspace root.
    return new MySandbox({ id: ctx.sessionId, cpus: settings.cpuCount ?? 2, workingDirectory: ctx.workingDirectory });
  }
}
```
