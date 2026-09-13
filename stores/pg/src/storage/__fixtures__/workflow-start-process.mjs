import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow, createEventedWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';
import { PostgresStore } from '@mastra/pg';

const [runId, mode, engine = 'default'] = process.argv.slice(2);
const buildWorkflow = engine === 'evented' ? createEventedWorkflow : createWorkflow;
const storage = new PostgresStore({
  id: `process-${process.pid}`,
  connectionString: process.env.WORKFLOW_START_TEST_DATABASE_URL,
  schemaName: process.env.WORKFLOW_START_TEST_SCHEMA,
  disableInit: true,
});
let release;
const released = new Promise(resolve => {
  release = resolve;
});
const step = createStep({
  id: 'work',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ item: z.string(), total: z.number(), tenant: z.string() }),
  execute: async ({ inputData, state, requestContext }) => {
    process.send({ type: 'entered', pid: process.pid });
    if (mode !== 'restart') await released;
    return { ...inputData, total: state.total, tenant: requestContext.get('tenant') };
  },
});
let workflow = buildWorkflow({
  id: 'process-start',
  inputSchema: step.inputSchema,
  outputSchema: step.outputSchema,
  stateSchema: z.object({ total: z.number() }),
})
  .then(step)
  .commit();
let workflows = { [workflow.id]: workflow };
if (mode.startsWith('callback-')) {
  const schema = z.object({ item: z.string() });
  const tool = createTool({
    id: 'callback-tool',
    description: 'Wait for an external callback',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: schema,
    execute: async (input, context) => {
      process.send({ type: 'root', rootRun: context.workflow.rootRun });
      if (!context.workflow.resumeData?.approved) {
        await context.workflow.suspend(input, { resumeLabel: 'callback' });
        return input;
      }
      return { item: `${input.item}:approved` };
    },
  });
  const helper = buildWorkflow({ id: 'callback-helper', inputSchema: schema, outputSchema: schema })
    .then(createStep(tool))
    .commit();
  const middle = buildWorkflow({ id: 'callback-middle', inputSchema: schema, outputSchema: schema })
    .then(helper)
    .commit();
  workflow = buildWorkflow({ id: 'callback-root', inputSchema: schema, outputSchema: schema }).then(middle).commit();
  workflows = { [workflow.id]: workflow, [helper.id]: helper, [middle.id]: middle };
}
const mastra = new Mastra({ storage, workflows, logger: false });
if (engine === 'evented') await mastra.startWorkers();
if (mode === 'crash') workflow.executionEngine.execute = async () => process.exit(23);
process.on('message', async message => {
  if (message === 'release') {
    release();
    return;
  }
  if (message !== 'start') return;
  try {
    const run = await workflow.createRun({ runId, resourceId: 'test-owner' });
    const result =
      mode === 'callback-resume'
        ? await run.resume({ label: 'callback', resumeData: { approved: true } })
        : mode === 'restart'
          ? await run.restart()
          : await run.start({
              inputData: { item: 'widget' },
              initialState: { total: 7 },
              requestContext: new RequestContext([['tenant', 'one']]),
            });
    process.send({ type: 'result', result });
  } catch (error) {
    process.send({ type: 'error', id: error.id, message: error.message });
  } finally {
    await mastra.stopWorkers();
    await storage.close();
    process.disconnect();
  }
});
process.send({ type: 'ready', pid: process.pid });
