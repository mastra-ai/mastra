import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';
import { z } from 'zod/v4';
import { Observability } from '../../../../../observability/mastra/src/default';
import {
  createResumeOutcomeStep,
  createResumeSeed,
} from '../../../../../observability/mastra/src/test-utils/workflow-outcome-fixtures';
import type { ControlFlowResumeKind } from '../../../../../observability/mastra/src/test-utils/workflow-outcome-fixtures';
import { connect } from '../../connect';
import { init } from '../../index';

export type OutcomeWorkflowKind = ControlFlowResumeKind | 'cancel-wait' | 'cancel-nested-wait';

export function buildOutcomeWorkflow(dbUrl: string, port: number, kind: OutcomeWorkflowKind, eventsPath?: string) {
  const namespace = createHash('sha256').update(dbUrl).digest('hex').slice(0, 12);
  const inngest = new Inngest({ id: `native-outcome-process-${namespace}`, baseUrl: `http://localhost:${port}` });
  const { createWorkflow, createStep } = init(inngest);
  const workflow = createWorkflow({
    id: `process-resume-${namespace}-${kind}`,
    inputSchema: z.object({}),
    outputSchema: z.union([z.array(z.object({})), z.object({})]),
    retryConfig: { attempts: 0, delay: 0 },
  });
  const step = createResumeOutcomeStep();
  let waitingWorkflowId: string = workflow.id;
  if (kind === 'cancel-wait' || kind === 'cancel-nested-wait') {
    const waitingWorkflow =
      kind === 'cancel-nested-wait'
        ? createWorkflow({
            id: `${workflow.id}-child`,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
          })
        : workflow;
    waitingWorkflowId = waitingWorkflow.id;
    waitingWorkflow
      .then(
        createStep({
          id: 'decision-success',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        }),
      )
      .sleep(60000)
      .commit();
    if (kind === 'cancel-nested-wait') workflow.then(waitingWorkflow).commit();
  } else if (kind === 'parallel') workflow.parallel([step]).commit();
  else if (kind === 'conditional') workflow.branch([[async () => true, step]]).commit();
  else if (kind === 'until') workflow.dountil(step, async () => true).commit();
  else if (kind === 'while') workflow.dowhile(step, async () => false).commit();
  else workflow.then(createResumeSeed()).foreach(step, { concurrency: 1 }).commit();
  const storage = new DefaultStorage({ id: 'process-outcomes', url: dbUrl });
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow },
    ...(eventsPath
      ? {
          observability: new Observability({
            configs: {
              default: {
                serviceName: 'process-outcomes',
                exporters: [
                  {
                    name: 'disk-events',
                    exportTracingEvent: async event => {
                      appendFileSync(eventsPath, JSON.stringify({ pid: process.pid, event }) + '\n');
                    },
                    flush: async () => {},
                    shutdown: async () => {},
                  },
                ],
              },
            },
          }),
        }
      : {}),
  });
  return { mastra, storage, workflow, inngest, waitingWorkflowId };
}

// Importing the fixture in the client only constructs its own workflow registry.
if (process.argv[2] === 'worker') {
  const [, , , dbUrl, port, kind, eventsPath] = process.argv;
  if (!dbUrl || !port || !kind || !eventsPath) throw new Error('Missing worker arguments');
  const host = buildOutcomeWorkflow(dbUrl, Number(port), kind as OutcomeWorkflowKind, eventsPath);
  const connection = await connect({ mastra: host.mastra, inngest: host.inngest });
  process.send?.({ type: 'ready' });
  process.once(
    'SIGTERM',
    () =>
      void (async () => {
        await connection.close();
        await connection.closed;
        await host.mastra.shutdown();
        await host.storage.close();
        process.exit(0);
      })(),
  );
}
