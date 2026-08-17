import type { InMemoryDB } from '../inmemory-db';
import type { SignalSubscriptionFilter, StoredSignalSubscription } from './base';
import { SignalSubscriptionsStorage } from './base';

function clone<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export class InMemorySignalSubscriptionsStorage extends SignalSubscriptionsStorage {
  readonly #db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.#db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#db.signalSubscriptions.clear();
  }

  async upsertSubscription(subscription: StoredSignalSubscription): Promise<StoredSignalSubscription> {
    const stored = clone(subscription);
    this.#db.signalSubscriptions.set(stored.id, stored);
    return clone(stored);
  }

  async deleteSubscription(id: string): Promise<void> {
    this.#db.signalSubscriptions.delete(id);
  }

  async deleteSubscriptions(filter: SignalSubscriptionFilter): Promise<void> {
    for (const [id, subscription] of this.#db.signalSubscriptions) {
      if (matches(subscription, filter)) this.#db.signalSubscriptions.delete(id);
    }
  }

  async listSubscriptions(filter: SignalSubscriptionFilter): Promise<StoredSignalSubscription[]> {
    return Array.from(this.#db.signalSubscriptions.values())
      .filter(subscription => matches(subscription, filter))
      .sort((a, b) => a.subscribedAt - b.subscribedAt)
      .map(clone);
  }
}

function matches(subscription: StoredSignalSubscription, filter: SignalSubscriptionFilter): boolean {
  return (
    subscription.providerId === filter.providerId &&
    (filter.threadId === undefined || subscription.threadId === filter.threadId) &&
    (filter.resourceId === undefined || subscription.resourceId === filter.resourceId) &&
    (filter.externalResourceId === undefined || subscription.externalResourceId === filter.externalResourceId)
  );
}
