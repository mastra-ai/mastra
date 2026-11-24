import type { NotificationChannel } from '../../contracts/communications/notifications.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerNotificationChannel implements NotificationChannel {
  readonly id = 'customer-notification-channel';
  readonly capabilities: ProviderCapabilities = {
    operations: ['NOTIFICATION'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['NONE'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  deliver(
    input: Parameters<NotificationChannel['deliver']>[0],
    context: Parameters<NotificationChannel['deliver']>[1],
  ): ReturnType<NotificationChannel['deliver']> {
    void input;
    void context;
    // TODO: Call the customer notification or Mastra Channel delivery operation.
    // TODO: Return NotificationDeliveryResult with a stable channel status.
    // TODO: Map rate-limit, timeout, rejection, and availability errors to ProviderError.
    // TODO: Send only case reference, event type, and action link; honor deadline and idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'NOTIFICATION',
        safeMessage: 'Customer notification channel is not implemented',
      }),
    );
  }
}
