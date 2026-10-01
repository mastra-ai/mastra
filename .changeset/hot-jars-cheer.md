---
'@mastra/core': minor
---

Added durable signal subscriptions to `SignalProvider`. Subscriptions made through the new async methods are stored in the `signalSubscriptions` storage domain, so they survive restarts and are visible to every process that shares the same storage. The existing in-memory methods (`subscribe`, `getSubscriptions`, and the rest) are unchanged.

```typescript
class MySignals extends SignalProvider<'my-signals'> {
  readonly id = 'my-signals'

  async watch(target: SignalProviderTarget, prId: string) {
    // Before: kept in process memory, lost on restart
    this.subscribe(target, prId)

    // After: stored in Mastra storage and shared across processes
    await this.subscribeDurable(target, prId, { pr: prId })
  }
}
```

New protected methods: `subscribeDurable`, `unsubscribeDurable`, `getDurableSubscriptions`, `getDurableSubscriptionsForResource`, `hasDurableSubscription`, `unsubscribeAllDurable`, and `setDurableSubscriptionEnabled`. Subscriptions are scoped by agent, so two agents that share a provider id never see each other's subscriptions. If the configured storage doesn't provide the `signalSubscriptions` domain, these methods throw instead of silently falling back to process memory. `stop()` overrides may now return `void` or `Promise<void>`.
