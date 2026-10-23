import type { WebhookPublisher } from '../../contracts/communications/webhook-publisher.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerWebhookPublisher implements WebhookPublisher {
  readonly id = 'customer-webhook-publisher';
  readonly capabilities: ProviderCapabilities = {
    operations: ['WEBHOOK_PUBLICATION'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['NONE'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  publish(
    input: Parameters<WebhookPublisher['publish']>[0],
    context: Parameters<WebhookPublisher['publish']>[1],
  ): ReturnType<WebhookPublisher['publish']> {
    void input;
    void context;
    // TODO: Call the customer webhook endpoint with the canonical safe payload and signature metadata.
    // TODO: Return PublishWebhookResult with the provider delivery reference.
    // TODO: Map rate-limit, timeout, rejection, and availability errors to ProviderError.
    // TODO: Exclude identity PII, honor the deadline, and reuse the delivery idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'WEBHOOK_PUBLICATION',
        safeMessage: 'Customer webhook publishing is not implemented',
      }),
    );
  }
}
