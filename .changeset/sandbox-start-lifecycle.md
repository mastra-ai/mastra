---
'@mastra/core': minor
---

**Sandbox setup failures are no longer silent**

An error thrown by an `onStart` handler now fails the start: `start()` rejects and the sandbox is marked `error`. Previously the error was logged and swallowed, so a sandbox whose setup never ran still looked healthy, and the failure surfaced later as a confusing command error.

**Added `find()`, `connect()` and `create()` for sandbox providers**

A provider can implement these three optional methods instead of writing `start()`. Mastra calls them in order, so providers no longer hand-roll "reuse the existing sandbox, otherwise make one", and Mastra knows which one happened:

```typescript
class MySandbox extends MastraSandbox<MyHandle> {
  protected async find() {
    return (await sdk.list({ id: this.id }))[0]
  }
  protected async connect(handle: MyHandle) {
    this.vm = await sdk.resume(handle)
  }
  protected async create() {
    this.vm = await sdk.create({ id: this.id })
  }
}
```

Providers whose SDK gets-or-creates in one call keep overriding `start()`.

**Added the start outcome, so setup can tell a new sandbox from a resumed one**

`onStart` now receives `outcome`, either `'created'` or `'connected'`, which is `undefined` for providers that don't report it:

```typescript
new MySandbox({
  onStart: async ({ outcome }) => {
    if (outcome === 'created') await installDependencies()
  },
})
```

**Added `setOnStart()` for attaching setup to a sandbox you didn't build**

Useful when a runtime is handed a sandbox and needs setup on it without every caller passing a hook to the constructor. It takes an updater over the installed hook, so a second caller composes rather than replacing one it didn't know about:

```typescript
sandbox.setOnStart?.(previous => async args => {
  await runSetup(args)
  await previous?.(args)
})
```

**Improved concurrent starts**

Two starts at once now share one attempt for every provider rather than only some, and a failed start is never cached, so the next call retries it. Starting a sandbox that implements neither `start()` nor `create()` throws instead of reporting itself `running` having provisioned nothing.
