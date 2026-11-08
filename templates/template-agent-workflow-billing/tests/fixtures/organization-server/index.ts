import { Mastra } from '@mastra/core/mastra';
import { configuredOrganizations } from '../../../src/mastra/environment.js';
import { billingOnlyServer, enforceBillingBoundary } from '../../../src/server/security.js';

const organizations = await configuredOrganizations();
export const mastra = enforceBillingBoundary(
  new Mastra({
    server: { host: '127.0.0.1', port: Number(process.env.BILLING_PORT), ...billingOnlyServer(organizations) },
  }),
);
