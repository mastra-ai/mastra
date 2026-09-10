import type { MastraWorker } from '@mastra/core/worker';

import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import { IncidentioApiClient } from '../../incidentio/api.js';
import { createIncidentioIntake } from '../../incidentio/intake.js';
import { attachIncidentioIssueReconciler } from '../../incidentio/issue-reconciler.js';
import {
  incidentioReconciliationEnabled,
  incidentioReconciliationInterval,
} from '../../incidentio/reconciliation-config.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import { platformApiClientConfigFromEnv, type PlatformApiClientConfig } from '../api-client.js';

export interface PlatformIncidentioIntegrationConfig {
  clientConfig?: PlatformApiClientConfig;
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

    const clientConfig = config.clientConfig ?? platformApiClientConfigFromEnv();
    this.#endpointHost = new URL(clientConfig.baseUrl).host;
    const proxyBaseUrl = `${clientConfig.baseUrl.replace(/\/+$/, '')}/v2/connections/${encodeURIComponent(
      connectionId,
    )}/proxy`;

    this.intake = createIncidentioIntake({
      api: new IncidentioApiClient({
        baseUrl: proxyBaseUrl,
        accessToken: clientConfig.accessToken,
        ...(clientConfig.fetchImpl ? { fetchImpl: clientConfig.fetchImpl } : {}),
      }),
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
