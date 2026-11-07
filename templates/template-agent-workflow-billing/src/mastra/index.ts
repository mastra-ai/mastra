import { Mastra } from '@mastra/core/mastra';
import { billingServerConfiguration } from './setup.js';
import { enforceBillingBoundary } from '../server/security.js';

export const mastra = new Mastra({ server: await billingServerConfiguration() });
enforceBillingBoundary(mastra);
