import { StorageDomain } from '../base';

export type StoredSignalSubscription = {
  id: string;
  providerId: string;
  threadId: string;
  resourceId: string;
  externalResourceId: string;
  subscribedAt: number;
  metadata?: Record<string, unknown>;
};

export type SignalSubscriptionFilter = {
  providerId: string;
  threadId?: string;
  resourceId?: string;
  externalResourceId?: string;
};

export abstract class SignalSubscriptionsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'SIGNAL_SUBSCRIPTIONS' });
  }

  async dangerouslyClearAll(): Promise<void> {}

  abstract upsertSubscription(subscription: StoredSignalSubscription): Promise<StoredSignalSubscription>;
  abstract deleteSubscription(id: string): Promise<void>;
  abstract deleteSubscriptions(filter: SignalSubscriptionFilter): Promise<void>;
  abstract listSubscriptions(filter: SignalSubscriptionFilter): Promise<StoredSignalSubscription[]>;
}
