import type { ChannelProvider } from '../../channels';
import type { Mastra } from '../../mastra';
import { HarnessConfigError } from './errors';
import type { HarnessChannelBinding, HarnessChannelConfig } from './types';

type PendingChannelRegistration = {
  channelId: string;
  providerId: string;
  platform?: string;
  config: HarnessChannelConfig;
};

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessConfigError(field, 'must be a non-empty string');
  }
}

function assertDurableComponent(value: string, field: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new HarnessConfigError(field, 'must contain only letters, numbers, underscores, or dashes');
  }
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HarnessConfigError(field, 'must be an object');
  }
}

function assertWorkerConfig(value: unknown, field: string): void {
  if (value === undefined) return;
  assertRecord(value, field);
  for (const key of ['maxAttempts', 'claimTtlMs', 'claimRenewMs', 'maxClockSkewMs', 'batchSize', 'pollIntervalMs']) {
    const candidate = value[key];
    if (candidate !== undefined && (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 1)) {
      throw new HarnessConfigError(`${field}.${key}`, 'must be a positive integer');
    }
  }
  if (value.retryBackoffMs !== undefined && typeof value.retryBackoffMs !== 'function') {
    throw new HarnessConfigError(`${field}.retryBackoffMs`, 'must be a function');
  }
}

export class HarnessChannelRegistry {
  private readonly pending = new Map<string, PendingChannelRegistration>();
  private bindings = new Map<string, HarnessChannelBinding>();

  constructor(config: Record<string, HarnessChannelConfig> | undefined) {
    if (config === undefined) return;
    assertRecord(config, 'channels');

    const bindingIds = new Map<string, string>();
    for (const [channelId, entry] of Object.entries(config)) {
      assertNonEmptyString(channelId, 'channels');
      assertDurableComponent(channelId, `channels["${channelId}"]`);
      assertRecord(entry, `channels["${channelId}"]`);

      const providerId = entry.providerId ?? channelId;
      assertNonEmptyString(providerId, `channels["${channelId}"].providerId`);
      if (entry.platform !== undefined) {
        assertNonEmptyString(entry.platform, `channels["${channelId}"].platform`);
      }
      if (entry.callbackTarget !== undefined) {
        assertNonEmptyString(entry.callbackTarget, `channels["${channelId}"].callbackTarget`);
      }
      assertRecord(entry.adapter, `channels["${channelId}"].adapter`);
      if (typeof entry.adapter.deliver !== 'function') {
        throw new HarnessConfigError(`channels["${channelId}"].adapter.deliver`, 'must be a function');
      }
      assertRecord(entry.ingress, `channels["${channelId}"].ingress`);
      if (typeof entry.ingress.resolveResource !== 'function') {
        throw new HarnessConfigError(`channels["${channelId}"].ingress.resolveResource`, 'must be a function');
      }
      assertWorkerConfig(entry.inbox, `channels["${channelId}"].inbox`);
      assertWorkerConfig(entry.actions, `channels["${channelId}"].actions`);
      assertWorkerConfig(entry.outbox, `channels["${channelId}"].outbox`);

      const bindingId = entry.bindingId ?? channelId;
      assertNonEmptyString(bindingId, `channels["${channelId}"].bindingId`);
      assertDurableComponent(bindingId, `channels["${channelId}"].bindingId`);
      const existing = bindingIds.get(bindingId);
      if (existing) {
        throw new HarnessConfigError(
          `channels["${channelId}"].bindingId`,
          `duplicates binding id "${bindingId}" already used by channel "${existing}"`,
        );
      }
      bindingIds.set(bindingId, channelId);
      this.pending.set(channelId, { channelId, providerId, platform: entry.platform, config: entry });
    }
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  bind(mastra: Mastra, harnessName: string): void {
    if (this.pending.size === 0) {
      this.bindings = new Map();
      return;
    }
    assertNonEmptyString(harnessName, 'harnessName');
    assertDurableComponent(harnessName, 'harnessName');

    const providers = mastra.getChannelProviders() ?? {};
    const next = new Map<string, HarnessChannelBinding>();
    // Route mounting will enforce callback target uniqueness across harnesses.
    // Here we only have one harness's static config and can catch local drift.
    const callbackTargets = new Map<string, string>();

    for (const registration of this.pending.values()) {
      const provider = providers[registration.providerId];
      if (!provider) {
        throw new HarnessConfigError(
          `channels["${registration.channelId}"].providerId`,
          `references unknown channel provider "${registration.providerId}"`,
        );
      }
      const providerPlatform = this.resolveProviderPlatform(provider, registration);
      const platform = registration.platform ?? providerPlatform;
      if (registration.platform !== undefined && registration.platform !== providerPlatform) {
        throw new HarnessConfigError(
          `channels["${registration.channelId}"].platform`,
          `does not match provider "${registration.providerId}" platform "${providerPlatform}"`,
        );
      }

      const bindingId = registration.config.bindingId ?? registration.channelId;
      const callbackTarget = registration.config.callbackTarget ?? registration.channelId;
      const callbackKey = `${registration.providerId}\0${platform}\0${callbackTarget}`;
      const existing = callbackTargets.get(callbackKey);
      if (existing) {
        throw new HarnessConfigError(
          `channels["${registration.channelId}"].callbackTarget`,
          `duplicates callback target "${callbackTarget}" already used by channel "${existing}"`,
        );
      }
      callbackTargets.set(callbackKey, registration.channelId);

      next.set(registration.channelId, {
        harnessName,
        channelId: registration.channelId,
        bindingId,
        providerId: registration.providerId,
        platform,
        callbackTarget,
        durableId: `${harnessName}:${registration.channelId}:${bindingId}`,
      });
    }

    this.bindings = next;
  }

  list(): HarnessChannelBinding[] {
    return Array.from(this.bindings.values()).map(binding => ({ ...binding }));
  }

  get(channelId: string): HarnessChannelBinding | undefined {
    const binding = this.bindings.get(channelId);
    return binding ? { ...binding } : undefined;
  }

  private resolveProviderPlatform(provider: ChannelProvider, registration: PendingChannelRegistration): string {
    const platform = provider.id;
    if (typeof platform !== 'string' || platform.length === 0) {
      throw new HarnessConfigError(
        `channels["${registration.channelId}"].providerId`,
        `provider "${registration.providerId}" must expose a non-empty id`,
      );
    }
    return platform;
  }
}
