import { chmod, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { initializeMastraBilling } from '../../src/billing/mastra-setup.js';
import { workflowResource } from '../../src/billing/mastra-resources.js';
import { runtimeFixture } from './mastra.js';

const [phase, serialized, executionId] = process.argv.slice(2);
const options = JSON.parse(serialized);
const runtime = await runtimeFixture(options);
const schema = z.object({ private: z.string() });
const filename = fileURLToPath(options.workflowDatabaseUrl);
const paths = [filename, `${filename}-wal`, `${filename}-shm`];
const modes = () => Promise.all(paths.map(async file => (await stat(file)).mode & 0o777));
const open = async () => {
  const approval = createStep({
    id: 'approval',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: schema,
    execute: async ({ inputData, resumeData, suspend }) => (resumeData?.approved ? inputData : suspend(inputData)),
  });
  const workflow = createWorkflow({
    id: 'report',
    inputSchema: schema,
    outputSchema: schema,
    options: { autoRestartActiveRuns: false },
  })
    .then(approval)
    .commit();
  const components = await initializeMastraBilling({
    organizations: runtime.organizations,
    configuration: runtime.configuration,
    agents: runtime.agents,
    workflows: { report: workflowResource(workflow, { version: 'private-v1' }) },
    databaseUrl: options.databaseUrl,
    workflowDatabaseUrl: options.workflowDatabaseUrl,
  });
  new Mastra({
    agents: { assistant: runtime.agents.assistant.native },
    workflows: { report: workflow },
    storage: components.storage,
  });
  return components;
};
const opened: Awaited<ReturnType<typeof open>>[] = [];
const publish = async (message: object) => {
  if (!process.send) return;
  await new Promise<void>((resolve, reject) => process.send!(message, error => (error ? reject(error) : resolve())));
};
try {
  const first = await open();
  opened.push(first);
  let result;
  if (phase === 'write') {
    const handle = await first.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'private-files' });
    await handle.start({
      billing: runtime.billingContext,
      idempotencyKey: 'private-start',
      inputData: { private: options.sentinel },
    });
    const initial = await modes();
    const sentinelInWal = (await readFile(`${filename}-wal`)).includes(Buffer.from(options.sentinel));
    for (const file of paths) await chmod(file, 0o644);
    const legacy = await modes();
    const reopened = await open();
    opened.push(reopened);
    const restricted = await modes();
    const recovered = await reopened.billing
      .workflow('report')
      .getRun({ billing: runtime.billingContext, executionId: handle.executionId });
    const response = await recovered.resume({
      billing: runtime.billingContext,
      idempotencyKey: 'private-resume',
      step: 'approval',
      resumeData: { approved: true },
    });
    result = {
      executionId: handle.executionId,
      initial,
      sentinelInWal,
      legacy,
      restricted,
      output: response.kind === 'immediate' ? response.projection.output : response.result.output,
    };
  } else {
    const handle = await first.billing.workflow('report').getRun({ billing: runtime.billingContext, executionId });
    const response = await handle.status(runtime.billingContext);
    result = {
      modes: await modes(),
      output: response.kind === 'immediate' ? response.projection.output : response.result.output,
    };
  }
  await publish(result);
} catch (error) {
  await publish({ error: error instanceof Error ? error.stack : String(error) });
  process.exitCode = 1;
} finally {
  for (const components of opened.reverse()) await components.close();
  await runtime.close();
}
// Process exit is required: a retained native SQLite connection must not make
// the following process's checkpoint/recreation test depend on object disposal.
process.exit(process.exitCode ?? 0);
