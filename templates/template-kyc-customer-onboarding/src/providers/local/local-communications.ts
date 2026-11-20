import type { Client } from '@libsql/client';

import type { NotificationChannel, NotificationProvider } from '../../contracts/communications/notifications.js';
import {
  notificationDeliveryResultSchema,
  sendNotificationInputSchema,
} from '../../contracts/communications/notifications.js';
import { publishWebhookInputSchema, type WebhookPublisher } from '../../contracts/communications/webhook-publisher.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import {
  ProviderRejectedInputError,
  ProviderUnavailableError,
  type ProviderCapabilities,
} from '../../contracts/shared/provider.js';
import { IdempotencyConflictError } from '../../domain/errors.js';
import { signWebhook, type WebhookKeyring } from '../../server/webhook-signing.js';
import { fingerprintRequest, runIdempotentMutation } from '../../storage/libsql/idempotent-mutation.js';

const capabilities = (operation: 'NOTIFICATION' | 'WEBHOOK_PUBLICATION'): ProviderCapabilities => ({
  operations: [operation],
  environments: ['test', 'demo-default', 'demo-strict'],
  externalNetwork: false,
  idempotent: true,
  supportedPiiModes: ['demo-default', 'demo-strict'],
  acceptedPii: ['NONE'],
  documentMimeTypes: [],
  jurisdictions: ['US'],
});

const assertTenant = (
  providerId: string,
  operation: 'NOTIFICATION' | 'WEBHOOK_PUBLICATION',
  tenantId: string,
  context: ProviderExecutionContext,
): void => {
  if (tenantId !== context.execution.tenantId) {
    throw new ProviderRejectedInputError({
      providerId,
      operation,
      safeMessage: 'The execution tenant does not match the delivery tenant',
    });
  }
};

export class CapturingNotificationChannel implements NotificationChannel {
  readonly id = 'local-inbox';
  readonly capabilities = Object.freeze(capabilities('NOTIFICATION'));
  readonly deliveries = new Map<string, Parameters<NotificationChannel['deliver']>[0]>();

  async deliver(input: Parameters<NotificationChannel['deliver']>[0], context: ProviderExecutionContext) {
    await Promise.resolve();
    const parsed = sendNotificationInputSchema.parse(input);
    assertTenant(this.id, 'NOTIFICATION', parsed.notification.tenantId, context);
    const key = `${parsed.notification.tenantId}\0NOTIFICATION\0${this.id}\0${parsed.idempotencyKey}`;
    const existing = this.deliveries.get(key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new IdempotencyConflictError();
    }
    if (existing === undefined) this.deliveries.set(key, parsed);
    return {
      channelId: this.id,
      status: 'DELIVERED' as const,
      replayed: existing !== undefined,
    };
  }
}

export class SafeConsoleNotificationChannel implements NotificationChannel {
  readonly id = 'safe-console';
  readonly capabilities = Object.freeze(capabilities('NOTIFICATION'));
  readonly deliveries = new Map<string, Parameters<NotificationChannel['deliver']>[0]>();

  constructor(private readonly write: (message: string) => void = () => undefined) {}

  async deliver(input: Parameters<NotificationChannel['deliver']>[0], context: ProviderExecutionContext) {
    await Promise.resolve();
    const parsed = sendNotificationInputSchema.parse(input);
    assertTenant(this.id, 'NOTIFICATION', parsed.notification.tenantId, context);
    const key = `${parsed.notification.tenantId}\0NOTIFICATION\0${this.id}\0${parsed.idempotencyKey}`;
    const existing = this.deliveries.get(key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new IdempotencyConflictError();
    }
    if (existing === undefined) {
      this.deliveries.set(key, parsed);
      this.write(
        `[kyc-notification] ${parsed.notification.type} ${parsed.notification.id}: ${parsed.notification.safeMessage}`,
      );
    }
    return {
      channelId: this.id,
      status: 'DELIVERED' as const,
      replayed: existing !== undefined,
    };
  }
}

export class CapturingWebhookNotificationChannel implements NotificationChannel {
  readonly id = 'local-webhook-capture';
  readonly capabilities = Object.freeze(capabilities('NOTIFICATION'));
  readonly deliveries = new Map<string, Parameters<NotificationChannel['deliver']>[0]>();

  async deliver(input: Parameters<NotificationChannel['deliver']>[0], context: ProviderExecutionContext) {
    await Promise.resolve();
    const parsed = sendNotificationInputSchema.parse(input);
    assertTenant(this.id, 'NOTIFICATION', parsed.notification.tenantId, context);
    const key = `${parsed.notification.tenantId}\0NOTIFICATION\0${this.id}\0${parsed.idempotencyKey}`;
    const existing = this.deliveries.get(key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new IdempotencyConflictError();
    }
    if (existing === undefined) this.deliveries.set(key, parsed);
    return {
      channelId: this.id,
      status: 'DELIVERED' as const,
      replayed: existing !== undefined,
    };
  }
}

export class SignedWebhookNotificationChannel implements NotificationChannel {
  readonly id = 'signed-webhook';
  readonly capabilities: ProviderCapabilities = Object.freeze({
    ...capabilities('NOTIFICATION'),
    environments: ['test', 'demo-default', 'demo-strict', 'live'] as ProviderCapabilities['environments'],
    externalNetwork: true,
  });

  constructor(
    private readonly url: string,
    private readonly keyring: WebhookKeyring,
    private readonly request: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async deliver(input: Parameters<NotificationChannel['deliver']>[0], context: ProviderExecutionContext) {
    const parsed = sendNotificationInputSchema.parse(input);
    assertTenant(this.id, 'NOTIFICATION', parsed.notification.tenantId, context);
    const deliveryId = `notification-${parsed.notification.id}`;
    const timestamp = String(Math.floor(this.now().getTime() / 1_000));
    const message = signWebhook({
      key: this.keyring.current,
      timestamp,
      deliveryId,
      idempotencyKey: parsed.idempotencyKey,
      body: {
        schemaVersion: '1.0',
        event: 'kyc.notification',
        notification: parsed.notification,
      },
    });
    const remainingMs = Math.max(1, new Date(context.deadlineAt).getTime() - Date.now());
    let response: Response;
    try {
      response = await this.request(this.url, {
        method: 'POST',
        headers: message.headers,
        body: message.body,
        signal: AbortSignal.timeout(remainingMs),
      });
    } catch {
      throw new ProviderUnavailableError({
        providerId: this.id,
        operation: 'NOTIFICATION',
        safeMessage: 'The signed notification webhook is unavailable',
      });
    }
    if (!response.ok) {
      throw new ProviderUnavailableError({
        providerId: this.id,
        operation: 'NOTIFICATION',
        safeMessage: 'The signed notification webhook rejected the delivery',
        metadata: { status: response.status },
      });
    }
    return { channelId: this.id, status: 'DELIVERED' as const, replayed: false };
  }
}

export class LocalNotificationProvider implements NotificationProvider {
  constructor(
    private readonly client: Client,
    private readonly channels: readonly NotificationChannel[],
  ) {}

  async send(input: Parameters<NotificationProvider['send']>[0], context: ProviderExecutionContext) {
    const parsed = sendNotificationInputSchema.parse(input);
    assertTenant('local-inbox', 'NOTIFICATION', parsed.notification.tenantId, context);
    const notificationJson = JSON.stringify(parsed.notification);
    return Promise.all(
      this.channels.map(async channel => {
        const deliveryKey = `${parsed.idempotencyKey}:${channel.id}`;
        const mutation = await runIdempotentMutation({
          client: this.client,
          tenantId: parsed.notification.tenantId,
          operation: `NOTIFICATION:${channel.id}`,
          key: parsed.idempotencyKey,
          requestFingerprint: fingerprintRequest(parsed.notification),
          createdAt: parsed.notification.createdAt,
          completedAt: parsed.notification.createdAt,
          execute: async transaction => {
            const existingNotification = await transaction.execute({
              sql: 'SELECT payload_json FROM notifications WHERE tenant_id = ? AND id = ?',
              args: [parsed.notification.tenantId, parsed.notification.id],
            });
            const storedNotification = existingNotification.rows[0]?.payload_json;
            if (storedNotification !== undefined && storedNotification !== notificationJson) {
              throw new IdempotencyConflictError();
            }
            if (storedNotification === undefined) {
              await transaction.execute({
                sql: `INSERT INTO notifications
                  (tenant_id,id,case_id,payload_json,created_at) VALUES (?,?,?,?,?)`,
                args: [
                  parsed.notification.tenantId,
                  parsed.notification.id,
                  parsed.notification.caseId,
                  notificationJson,
                  parsed.notification.createdAt,
                ],
              });
            }
            const existingDelivery = await transaction.execute({
              sql: `SELECT idempotency_key FROM notification_deliveries
                WHERE tenant_id = ? AND notification_id = ? AND channel_id = ?`,
              args: [parsed.notification.tenantId, parsed.notification.id, channel.id],
            });
            if (existingDelivery.rows.length > 0) throw new IdempotencyConflictError();

            const delivered = notificationDeliveryResultSchema.parse(await channel.deliver(parsed, context));
            const result = notificationDeliveryResultSchema.parse({
              ...delivered,
              replayed: false,
            });
            await transaction.execute({
              sql: `INSERT INTO notification_deliveries
                (tenant_id,notification_id,channel_id,idempotency_key,status,payload_json,created_at)
                VALUES (?,?,?,?,?,?,?)`,
              args: [
                parsed.notification.tenantId,
                parsed.notification.id,
                result.channelId,
                deliveryKey,
                result.status,
                JSON.stringify(result),
                parsed.notification.createdAt,
              ],
            });
            return result;
          },
          parseResult: value => notificationDeliveryResultSchema.parse(value),
        });
        return notificationDeliveryResultSchema.parse({
          ...mutation.result,
          replayed: mutation.replayed,
        });
      }),
    );
  }
}

export class CapturingWebhookPublisher implements WebhookPublisher {
  readonly id = 'capture';
  readonly capabilities = Object.freeze(capabilities('WEBHOOK_PUBLICATION'));
  readonly deliveries = new Map<string, Parameters<WebhookPublisher['publish']>[0]>();

  async publish(input: Parameters<WebhookPublisher['publish']>[0], context: ProviderExecutionContext) {
    await Promise.resolve();
    const parsed = publishWebhookInputSchema.parse(input);
    assertTenant(this.id, 'WEBHOOK_PUBLICATION', parsed.tenantId, context);
    const key = `${parsed.tenantId}\0WEBHOOK_PUBLICATION\0${this.id}\0${parsed.idempotencyKey}`;
    const existing = this.deliveries.get(key);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new IdempotencyConflictError();
    }
    if (existing === undefined) this.deliveries.set(key, parsed);
    return {
      deliveryId: `delivery-${parsed.idempotencyKey}`,
      status: 'CAPTURED' as const,
      replayed: existing !== undefined,
    };
  }
}
