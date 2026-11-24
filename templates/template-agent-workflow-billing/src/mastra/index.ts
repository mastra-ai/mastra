import { Mastra } from '@mastra/core/mastra';
import { createStudioBillingWrapper } from '../studio-billing/index.js';
import { createImageAssistantAgent } from './agents/image-assistant.js';
import { createBilling } from '../billing/integration.js';
import { localDemoAccounts } from '../billing/providers/local/accounts.js';
import { registerApplicationShutdown } from '../billing/lifecycle.js';
import { ImageService } from '../images/service.js';
import { createImageAgent } from './agents/image-agent.js';
import { createImageKit } from './workflows/image-kit.js';
import { imageAdapters } from '../images/image-adapters.js';

const billing = createBilling({
  provider: process.env.BILLING_PROVIDER ?? 'local',
  billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  plans: {
    allowances: [
      { key: 'starter-credits', version: 'v1', meter: 'credits', kind: 'order', units: 30, expiry: { type: 'none' } },
    ],
    offers: [{ key: 'starter', version: 'v1', allowances: [{ key: 'starter-credits', version: 'v1' }] }],
  },
  localAccounts: () => localDemoAccounts(process.env, 30),
});

const images = new ImageService(process.env, billing.artifacts);
const adapters = imageAdapters(images);
const integration = await billing.prepare({
  agents: {
    'image-agent': billing.agent(createImageAgent(process.env, images), {
      ...adapters[0],
      policy: { version: 'image-agent-v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
    }),
  },
  workflows: {
    'image-kit': billing.workflow(createImageKit(billing), {
      ...adapters[1],
      policy: {
        version: 'image-kit-v2',
        suspendedReservationTtlMs: 1800000,
        charge: { type: 'credits', meter: 'credits', units: 3 },
      },
    }),
  },
  artifacts: images,
});

const studioWrapper =
  process.env.BILLING_STUDIO_ENABLED === 'true' ? createStudioBillingWrapper({ integration }) : undefined;
if (studioWrapper)
  studioWrapper.decorateAgent(
    createImageAssistantAgent({
      image: studioWrapper.agentTool('image-agent'),
      ...studioWrapper.workflowTools('image-kit', { approvalSteps: ['approval'] }),
    }),
  );

export const mastra = new Mastra({
  agents: {
    ...integration.agents,
    ...studioWrapper?.agents,
    // Add ordinary native agents here to run without billing.
  },
  workflows: {
    ...integration.workflows,
    // Add ordinary native workflows here to run without billing.
  },
  tools: integration.tools,
  storage: integration.storage,
  logger: false,
  server: integration.server({ host: '127.0.0.1', port: Number(process.env.BILLING_PORT ?? 4111) }, { studioWrapper }),
});

await integration.attach(mastra);
registerApplicationShutdown(billing.close);
