import type { MastraWorker } from '@mastra/core/worker';

import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import { IncidentioApiClient, IncidentioApiError, type IncidentioRequest } from '../../incidentio/api.js';
import { createIncidentioIntake } from '../../incidentio/intake.js';
import { attachIncidentioIssueReconciler } from '../../incidentio/issue-reconciler.js';
import {
  incidentioReconciliationEnabled,
  incidentioReconciliationInterval,
} from '../../incidentio/reconciliation-config.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import { PlatformApiClient, PlatformApiError, platformApiClientConfigFromEnv } from '../api-client.js';

export interface PlatformIncidentioIntegrationConfig {
  client?: PlatformApiClient;
  connectionId?: string;
}

const CONNECTION_TOKEN_PREFIX = 'incidentio-connection:';

export class PlatformIncidentioIntegration implements FactoryIntegration {
  readonly id = 'incidentio';
  readonly intake;
  readonly #endpointHost: string;

  constructor(config: PlatformIncidentioIntegrationConfig = {}) {
    const connectionId = config.connectionId?.trim() || process.env.MASTRA_INCIDENT_IO_CONNECTION_ID?.trim();
    if (!connectionId) {
      throw new Error('PlatformIncidentioIntegration: missing required MASTRA_INCIDENT_IO_CONNECTION_ID.');
    }

    let client: PlatformApiClient;
    if (config.client) {
      client = config.client;
      this.#endpointHost = 'configured-client';
    } else {
      const platformConfig = platformApiClientConfigFromEnv();
      client = new PlatformApiClient(platformConfig);
      this.#endpointHost = new URL(platformConfig.baseUrl).host;
    }

    const request: IncidentioRequest = async (method, path, options = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined) query.set(key, String(value));
      }
      const proxyPath = `/v2/connections/${encodeURIComponent(connectionId)}/proxy${path}${
        query.size > 0 ? `?${query.toString()}` : ''
      }`;
      try {
        return await client.request(method, proxyPath, options.body);
      } catch (error) {
        if (error instanceof PlatformApiError) throw new IncidentioApiError(error.message, error.status);
        throw error;
      }
    };

    this.intake = createIncidentioIntake({
      api: new IncidentioApiClient(request),
      connection: { type: 'oauth', accessToken: `${CONNECTION_TOKEN_PREFIX}${connectionId}` },
    });
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!incidentioReconciliationEnabled()) return [];
    const reconcile = attachIncidentioIssueReconciler(this, ctx);
    if (!reconcile) return [];
    const intervalMs = incidentioReconciliationInterval();
    return [
      new IssueReconcileWorker({
        integrationId: this.id,
        reconcile,
        ...(intervalMs ? { intervalMs } : {}),
      }),
    ];
  }

  routes(): [] {
    return [];
  }

  diagnostics(): Record<string, unknown> {
    return { mode: 'platform', endpointHost: this.#endpointHost, connectionConfigured: true };
  }
}
