import { lookup as defaultLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { Task } from '@mastra/core/a2a';
import type { IMastraLogger } from '@mastra/core/logger';
import type { InMemoryPushNotificationStore } from './push-notification-store';

export const DEFAULT_PUSH_NOTIFICATION_TOKEN_HEADER = 'X-A2A-Notification-Token';

function isDisallowedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    !normalized.includes('.')
  );
}

function isDisallowedIpv4(address: string) {
  const [first = -1, second = -1] = address.split('.').map(Number);

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isDisallowedIpv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === '::1' ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

function isDisallowedIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isDisallowedIpv4(address);
  }

  if (version === 6) {
    return isDisallowedIpv6(address);
  }

  return false;
}

export class DefaultPushNotificationSender {
  constructor(
    private readonly pushNotificationStore: InMemoryPushNotificationStore,
    private readonly options: {
      timeout?: number;
      tokenHeaderName?: string;
      fetch?: typeof fetch;
      lookup?: typeof defaultLookup;
      allowedHosts?: string[];
    } = {},
  ) {}

  getStore() {
    return this.pushNotificationStore;
  }

  private async resolveValidatedDestination(rawUrl: string) {
    const url = new URL(rawUrl);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`Push notification URL must use http or https: ${url.protocol}`);
    }

    const hostname = url.hostname.toLowerCase();
    if (this.options.allowedHosts && !this.options.allowedHosts.includes(hostname)) {
      throw new Error(`Push notification host is not allowed: ${hostname}`);
    }

    if (isDisallowedHostname(hostname)) {
      throw new Error(`Push notification URL must not target local or internal hosts: ${hostname}`);
    }

    if (isDisallowedIpAddress(hostname)) {
      throw new Error(`Push notification URL must not target local or private IPs: ${hostname}`);
    }

    const resolvedAddresses =
      isIP(hostname) === 0
        ? await (this.options.lookup ?? defaultLookup)(hostname, { all: true, verbatim: true })
        : [{ address: hostname, family: isIP(hostname) }];

    if (resolvedAddresses.some(result => isDisallowedIpAddress(result.address))) {
      throw new Error(`Push notification URL resolved to a local or private IP: ${hostname}`);
    }

    const requestUrl = new URL(url.toString());
    requestUrl.hostname = resolvedAddresses[0]!.address;

    return {
      originalUrl: url,
      requestUrl,
      hostHeader: url.host,
      servername: isIP(hostname) === 0 ? hostname : undefined,
    };
  }

  private async postTaskSnapshot({
    requestUrl,
    hostHeader,
    servername,
    headers,
    body,
    timeout,
  }: {
    requestUrl: URL;
    hostHeader: string;
    servername?: string;
    headers: Headers;
    body: string;
    timeout: number;
  }) {
    headers.set('host', hostHeader);
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeout) : undefined;

    if (this.options.fetch) {
      return this.options.fetch(requestUrl.toString(), {
        method: 'POST',
        headers,
        body,
        signal,
      });
    }

    const transport = requestUrl.protocol === 'https:' ? httpsRequest : httpRequest;

    return await new Promise<{ ok: boolean; status: number; statusText: string }>((resolve, reject) => {
      const request = transport(
        {
          protocol: requestUrl.protocol,
          hostname: requestUrl.hostname,
          port: requestUrl.port || undefined,
          path: `${requestUrl.pathname}${requestUrl.search}`,
          method: 'POST',
          headers: Object.fromEntries(headers.entries()),
          servername,
        },
        response => {
          response.resume();
          response.on('end', () => {
            resolve({
              ok: !!response.statusCode && response.statusCode >= 200 && response.statusCode < 300,
              status: response.statusCode ?? 0,
              statusText: response.statusMessage ?? '',
            });
          });
        },
      );

      request.on('error', reject);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            request.destroy(signal.reason instanceof Error ? signal.reason : new Error('Push notification timed out'));
          },
          { once: true },
        );
      }

      request.end(body);
    });
  }

  async sendNotifications({
    agentId,
    task,
    logger,
  }: {
    agentId: string;
    task: Task;
    logger?: IMastraLogger;
  }): Promise<void> {
    const configs = this.pushNotificationStore.list({
      agentId,
      params: { id: task.id },
    });

    if (configs.length === 0) {
      return;
    }

    await Promise.allSettled(
      configs.map(async config => {
        const headers = new Headers({
          'content-type': 'application/json',
        });

        if (config.pushNotificationConfig.token) {
          headers.set(
            this.options.tokenHeaderName ?? DEFAULT_PUSH_NOTIFICATION_TOKEN_HEADER,
            config.pushNotificationConfig.token,
          );
        }

        const auth = config.pushNotificationConfig.authentication;
        if (auth?.credentials) {
          if (auth.schemes.includes('Bearer')) {
            headers.set('authorization', `Bearer ${auth.credentials}`);
          } else if (auth.schemes.includes('Basic')) {
            headers.set('authorization', `Basic ${auth.credentials}`);
          }
        }

        const { requestUrl, hostHeader, servername } = await this.resolveValidatedDestination(
          config.pushNotificationConfig.url,
        );
        const response = await this.postTaskSnapshot({
          requestUrl,
          hostHeader,
          servername,
          headers,
          body: JSON.stringify(task),
          timeout: this.options.timeout ?? 5_000,
        });

        if (!response.ok) {
          throw new Error(
            `Push notification failed with status ${response.status} ${response.statusText ?? ''}`.trim(),
          );
        }
      }),
    ).then(results => {
      for (const result of results) {
        if (result.status === 'rejected') {
          logger?.error('Failed to deliver A2A push notification', result.reason);
        }
      }
    });
  }
}
