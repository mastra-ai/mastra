# SignalProvider Code Critique

## What's working well

**Clean declarative API.** The `Agent({ signals: [new GithubSignals()] })` pattern is a significant improvement over the manual two-step wiring. The intent is clear and the circular dependency is fully hidden from consumers.

**Subscription registry is solid.** The three-index approach (by key, by resource, by thread) gives O(1) lookups for all access patterns. The `subscribe()` / `unsubscribe()` / `getSubscriptionsForResource()` API is intuitive.

**Good JSDoc coverage.** Every public method and type has documentation with `@experimental` tags. The class-level JSDoc includes a usage example.

**Type guard.** `isSignalProvider()` enables runtime duck-typing checks which will be useful for the framework routing.

---

## Issues to address

### 1. Duplicated notification type — extract to shared type

The notification shape `{ source, kind, summary, priority?, payload?, dedupeKey?, coalesceKey?, attributes?, metadata? }` is inlined in three places:

- `SignalProvider.notify()` (signal-provider.ts:385-395)
- `WebhookSignalProvider.#buildNotification()` return type (webhook-signal-provider.ts:229-238)
- `WebhookSignalProviderOptions.buildNotification` callback return type (webhook-signal-provider.ts:36-47)

This is the same shape as the existing `SendNotificationSignalInput` from `@mastra/core/notifications/types`. We should import and reuse that type:

```ts
import type { SendNotificationSignalInput } from '../notifications/types';

// In notify():
protected async notify(notification: SendNotificationSignalInput, target: SignalProviderTarget): Promise<void> {
```

**Impact:** Eliminates drift between the provider API and the core notification system. One type to maintain.

### 2. `WebhookSignalProvider` has orphan monitoring methods

Lines 191-205 define `startMonitoring()`, `stopMonitoring()`, `isMonitoring()`, and `stopAll()` — but these methods aren't declared on `SignalProvider` and aren't part of any interface. They're just dead code that will confuse third-party developers who see them and think they need to implement them.

**Fix:** Remove these methods. If monitoring lifecycle becomes a requirement, add abstract/optional methods to `SignalProvider` first.

### 3. `protected` subscription methods limit WebhookSignalProvider's usability

`subscribe()`, `unsubscribe()`, `getSubscriptionsForResource()`, and `subscriptionCount` are all `protected` on `SignalProvider`. This forced `WebhookSignalProvider` to add pass-through wrappers (`subscribeThread()`, `unsubscribeThread()`) that do nothing except call `super`.

Third-party providers will all need these same wrappers. Consider:
- Making `subscribe()` / `unsubscribe()` public on SignalProvider, or
- Providing a public `subscriptions` accessor object (like `provider.subscriptions.add(...)`, `provider.subscriptions.forResource(...)`)

The current pattern adds boilerplate to every provider.

### 4. `WebhookSignalProvider<string>` loses type safety on `id`

```ts
export class WebhookSignalProvider extends SignalProvider<string> {
```

Since `id` is set at runtime from options, the generic parameter is just `string`. This means you lose the branded type safety that other processors have. Not critical, but worth noting — if providers are always instantiated with a known ID, a factory pattern or required generic could help.

### 5. Agent wiring comment is stale

```ts
// SignalProvider extends BaseProcessor which implements Processor, but the
```

SignalProvider no longer extends BaseProcessor (we changed it to `implements Processor`). The comment should be updated.

### 6. `stop()` clears subscriptions silently

`SignalProvider.stop()` clears all subscriptions and stops polling. This makes sense for shutdown, but there's no way to pause polling without losing subscriptions. Consider splitting into `stopPolling()` (already exists) and having `stop()` be more explicit about its destructive nature, or adding a `pause()` / `resume()` pattern.

### 7. `crypto.randomUUID()` in subscribe — fine for now, but consider

Using `crypto.randomUUID()` for subscription IDs is fine for in-memory use. If subscriptions ever need to be persisted or deduplicated across restarts, the ID generation strategy will need to change. Not a blocker.

### 8. No persistence hook for subscriptions

The subscription registry is purely in-memory. If the process restarts, all subscriptions are lost. GithubSignals solves this by storing subscriptions in thread metadata — but that pattern isn't surfaced in SignalProvider.

Consider adding optional hooks:
```ts
protected onSubscriptionAdded?(subscription: SignalSubscription): void | Promise<void>;
protected onSubscriptionRemoved?(subscription: SignalSubscription): void | Promise<void>;
```

Or a `loadSubscriptions()` lifecycle method called during `start()`. This would let providers persist subscriptions without reimplementing the registry.

---

## Approachability assessment

**For a third-party developer building a new provider:**

Good:
- The class-level JSDoc with the `SlackSignals` example is helpful
- The `poll()` + `pollInterval` pattern is intuitive
- `notify()` helper removes the need to understand `sendNotificationSignal` directly

Could be better:
- The relationship between `processInputStep` / `processOutputStep` (from Processor) and the signal-specific methods isn't documented. A developer reading the class doesn't know when they'd override `processInputStep` vs `poll` vs `handleWebhook`
- No "Building a SignalProvider" guide exists yet (this is the docs gap)
- The `WebhookSignalProvider` as a reference implementation is decent but the orphan monitoring methods and pass-through wrappers make it look more complex than it needs to be

**For the GithubSignals migration:**

The migration is clean — `extends SignalProvider` + `super()` + `override connect()`. The backward-compat `addAgent()` wrapper is a good transitional pattern. The only rough edge is that GithubSignals doesn't use `SignalProvider`'s subscription registry at all (it stores subscriptions in thread metadata), so the base class subscription machinery is unused baggage. This is fine for now but worth noting for the full migration later.

---

## Priority ordering

1. **Extract notification type** (quick win, removes real duplication)
2. **Remove orphan monitoring methods** (quick win, cleaner API surface)
3. **Fix stale comment** (quick win)
4. **Consider public subscription API** (design discussion)
5. **Add persistence hooks** (future iteration)
6. **Add docs** (next step)
