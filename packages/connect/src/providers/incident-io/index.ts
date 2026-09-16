// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createIncidentIoTools } from './tools.js';

export const incidentIoProvider: ProviderRegistration = {
  integrationId: 'incident-io',
  envVar: 'MASTRA_INCIDENT_IO_CONNECTION_ID',
  createTools: createIncidentIoTools,
};

export { createIncidentIoTools };
