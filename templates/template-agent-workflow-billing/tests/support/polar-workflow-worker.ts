import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { JwtIdentityAdapter } from '../../src/billing/identity.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { initializeMastraBilling } from '../../src/billing/mastra-setup.js';
import { workflowResource } from '../../src/billing/mastra-resources.js';

const [phase, serialized, executionId] = process.argv.slice(2);
const options = JSON.parse(serialized);
const directory = await OrganizationStorage.open(options.storage);
const organizations = new OrganizationService(directory, {
  mode: 'production',
  provider: 'polar',
  identity: new JwtIdentityAdapter(directory, {
    issuer: 'https://identity.example.test',
    audience: 'billing',
    algorithms: ['EdDSA'],
    jwks: options.jwks,
  }),
});
const context = await organizations.context({ credential: options.credential, workspaceId: options.workspaceId });
const schema = z.object({ count: z.number().int() });
const approval = createStep({
  id: 'approval',
  inputSchema: schema,
  outputSchema: schema,
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.approved) return suspend({ reason: 'Approval required' });
    return { count: inputData.count + 1 };
  },
});
const workflow = createWorkflow({
  id: 'report',
  inputSchema: schema,
  outputSchema: schema,
  options: { autoRestartActiveRuns: false },
})
  .then(approval)
  .commit();
const runtime = await initializeMastraBilling({
  organizations,
  databaseUrl: options.storage.url,
  configuration: options.configuration,
  agents: {},
  workflows: { report: workflowResource(workflow, { version: 'binding-workflow-v1' }) },
  polar: { ...options.polar, contact: async () => ({ email: 'trusted@example.test', name: 'Workspace billing' }) },
});
new Mastra({ workflows: { report: workflow }, storage: runtime.storage });
try {
  if (phase === 'deliver') {
    await runtime.recovery.runOnce();
    process.send?.({ delivered: true });
  } else {
    const handle =
      phase === 'start'
        ? await runtime.billing.workflow('report').createRun({ billing: context, idempotencyKey: 'binding-create' })
        : await runtime.billing.workflow('report').getRun({ billing: context, executionId });
    const response =
      phase === 'start'
        ? await handle.start({ billing: context, idempotencyKey: 'binding-start', inputData: { count: 0 } })
        : await handle.resume({
            billing: context,
            idempotencyKey: 'binding-resume',
            step: 'approval',
            resumeData: { approved: true },
          });
    process.send?.({
      executionId: handle.executionId,
      billing: response.billing,
      projection: response.kind === 'immediate' ? response.projection : response.result,
    });
  }
} catch (error) {
  process.send?.({ error: error instanceof Error ? error.stack : String(error) });
  process.exitCode = 1;
} finally {
  await runtime.close();
  organizations.close();
}
process.exit(process.exitCode ?? 0);
