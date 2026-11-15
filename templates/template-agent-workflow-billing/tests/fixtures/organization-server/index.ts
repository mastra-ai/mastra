import { Mastra } from '@mastra/core/mastra';
import { configuredOrganizations } from '../../../src/billing/configuration/environment.js';
import { createBillingServer, enforceBillingBoundary } from '../../../src/billing/server/boundary.js';

const organizations = await configuredOrganizations();
export const mastra = enforceBillingBoundary(
  new Mastra({
    server: {
      host: '127.0.0.1',
      port: Number(process.env.BILLING_PORT),
      ...createBillingServer({ organizations }),
    },
  }),
);
