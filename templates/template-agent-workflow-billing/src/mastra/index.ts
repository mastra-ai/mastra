import { createImageApplication } from './image-billing.js';
import { imageBillingKeys, imagePlans } from './image-plans.js';
import { registerApplicationShutdown } from '../billing/lifecycle.js';

const application = await createImageApplication({
  environment: process.env,
  billing: {
    billingKeys: imageBillingKeys,
    catalog: {
      allowances: imagePlans.allowances,
      offers: imagePlans.offers,
    },
  },
});

registerApplicationShutdown(application.close);
export const mastra = application.mastra;
