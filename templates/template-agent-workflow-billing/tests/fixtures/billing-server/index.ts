import { Mastra } from '@mastra/core/mastra';
import { runtimeFixture } from '../../support/mastra.js';
import { billingOnlyServer, enforceBillingBoundary } from '../../../src/server/security.js';
if (!process.env.BILLING_TEST_CONFIGURATION) throw new Error('The HTTP test requires isolated fixture configuration.');
const runtime = await runtimeFixture(JSON.parse(process.env.BILLING_TEST_CONFIGURATION));
export const mastra = new Mastra({
  agents: { assistant: runtime.agents.assistant.native },
  workflows: { report: runtime.workflows.report.native },
  storage: runtime.mastra.getStorage(),
  server: {
    host: '127.0.0.1',
    port: Number(process.env.BILLING_PORT),
    ...billingOnlyServer(runtime.organizations, runtime.billing.http),
  },
});
enforceBillingBoundary(mastra);
