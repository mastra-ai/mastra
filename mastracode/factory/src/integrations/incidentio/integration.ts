import type { MastraWorker } from '@mastra/core/worker';

import type { FactoryIntegration, IntegrationContext } from '../base.js';
import { IssueReconcileWorker } from '../issue-reconcile-worker.js';
import { IncidentioApiClient } from './api.js';
import { createIncidentioIntake } from './intake.js';
import { attachIncidentioIssueReconciler } from './issue-reconciler.js';
import { incidentioReconciliationEnabled, incidentioReconciliationInterval } from './reconciliation-config.js';

export interface IncidentioIntegrationConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

const DIRECT_CONNECTION_TOKEN = 'incidentio-direct-api-key';

export class IncidentioIntegration implements FactoryIntegration {
  readonly id = 'incidentio';
  readonly intake;
  readonly #endpointHost: string;

  constructor(config: IncidentioIntegrationConfig = {}) {
    const apiKey = config.apiKey?.trim() || process.env.INCIDENT_IO_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('IncidentioIntegration: missing required INCIDENT_IO_API_KEY.');
    }
    const baseUrl = config.baseUrl ?? 'https://api.incident.io';
    this.#endpointHost = new URL(baseUrl).host;
    const api = new IncidentioApiClient({
      baseUrl,
      accessToken: apiKey,
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    });
    this.intake = createIncidentioIntake({
      api,
      connection: { type: 'oauth', accessToken: DIRECT_CONNECTION_TOKEN },
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
    return { mode: 'api-key', endpointHost: this.#endpointHost };
  }
}
