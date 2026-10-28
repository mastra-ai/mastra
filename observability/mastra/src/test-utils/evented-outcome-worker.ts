import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { UnixSocketPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { createStep } from '@mastra/core/workflows';
import { createWorkflow } from '@mastra/core/workflows/evented';
import { z } from 'zod/v4';
import { LibSQLStore } from '../../../../stores/libsql/src/storage';
import { Observability } from '../default';
import { createOutcomeStep } from './workflow-outcome-fixtures';

export const remoteControlFlowModes = ['parallel', 'conditional', 'until', 'while', 'foreach'] as const;

export const remotePredicateModes = ['conditional-predicate', 'until-predicate', 'while-predicate'] as const;

export const remoteNestedModes = ['nested', 'nested-deep', 'nested-foreach'] as const;

export type RemoteOutcomeMode =
  | (typeof remoteNestedModes)[number]
  | (typeof remotePredicateModes)[number]
  | (typeof remoteControlFlowModes)[number]
  | 'success'
  | 'error'
  | 'tripwire'
  | 'bail'
  | 'suspend'
  | 'sleep'
  | 'sleep-until'
  | 'step';

export function buildEventedOutcomeHost(
  dbUrl: string,
  socketPath: string,
  eventsPath: string,
  mode: RemoteOutcomeMode,
  gatePath?: string,
  exportSpans = true,
) {
  const predicate = remotePredicateModes.includes(mode as (typeof remotePredicateModes)[number]);
  const nested = remoteNestedModes.includes(mode as (typeof remoteNestedModes)[number]);
  const control =
    nested || predicate || remoteControlFlowModes.includes(mode as (typeof remoteControlFlowModes)[number]);
  const outcome = mode === 'error' || mode === 'tripwire' || mode === 'bail' || mode === 'suspend' ? mode : 'success';
  const step = createOutcomeStep(outcome).step;
  if (gatePath && !predicate) {
    const execute = step.execute;
    step.execute = async args => {
      writeFileSync(`${gatePath}.started`, 'started');
      writeFileSync(`${gatePath}.${args.runId}.started`, 'started');
      while (!existsSync(gatePath)) await new Promise(resolve => setTimeout(resolve, 10));
      return execute(args);
    };
  }
  const condition = async () => {
    if (gatePath && predicate) {
      writeFileSync(`${gatePath}.started`, 'started');
      while (!existsSync(gatePath)) await new Promise(resolve => setTimeout(resolve, 10));
    }
    return mode !== 'while' && mode !== 'while-predicate';
  };
  const builder = createWorkflow({
    id: `process-evented-${mode}`,
    inputSchema: z.object({}),
    outputSchema: mode === 'foreach' || mode === 'nested-foreach' ? z.array(z.object({})) : z.object({}),
    retryConfig: { attempts: 0, delay: 0 },
  });
  if (mode === 'step') builder.then(createOutcomeStep('success', 'completed-peer').step).sleep(5);
  if (control) builder.dountil(createOutcomeStep('success', 'completed-control-peer').step, async () => true).sleep(5);
  const nestedWorkflows = [];
  const nestedWorkflow = nested
    ? createWorkflow({
        id: `process-evented-child-${mode}`,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(step)
        .commit()
    : undefined;
  if (nestedWorkflow) {
    const completedChild = createWorkflow({
      id: `completed-child-${mode}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(createOutcomeStep('success', 'completed-nested-step').step)
      .commit();
    nestedWorkflows.push(nestedWorkflow, completedChild);
    builder.then(completedChild);
    if (mode === 'nested-deep') {
      const middle = createWorkflow({
        id: `middle-child-${mode}`,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(nestedWorkflow)
        .commit();
      nestedWorkflows.push(middle);
      builder.then(middle);
    } else if (mode === 'nested-foreach') {
      builder
        .then(
          createStep({
            id: 'nested-items',
            inputSchema: z.object({}),
            outputSchema: z.array(z.object({})),
            execute: async () => [{}, {}],
          }),
        )
        .foreach(nestedWorkflow, { concurrency: 2 });
    } else builder.then(nestedWorkflow);
  } else if (mode === 'parallel') builder.parallel([step]);
  else if (mode === 'conditional' || mode === 'conditional-predicate') builder.branch([[condition, step]]);
  else if (mode === 'until' || mode === 'until-predicate') builder.dountil(step, condition);
  else if (mode === 'while' || mode === 'while-predicate') builder.dowhile(step, condition);
  else if (mode === 'foreach')
    builder
      .then(
        createStep({
          id: 'recovery-items',
          inputSchema: z.object({}),
          outputSchema: z.array(z.object({})),
          execute: async () => [{}],
        }),
      )
      .foreach(step, { concurrency: 1 });
  else builder.then(step);
  if (mode === 'sleep' || mode === 'sleep-until') builder.sleep(5);
  if (mode === 'sleep') builder.sleep(60000);
  if (mode === 'sleep-until') builder.sleepUntil(async () => new Date(Date.now() + 60000));
  const workflow = builder.commit();
  const storage = new LibSQLStore({ id: 'evented-process', url: dbUrl });
  const pubsub = new UnixSocketPubSub(socketPath);
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'evented-process',
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
  });
  const instance = observability.getInstance('default')!;
  observability.unregisterInstance('default');
  observability.registerInstance('worker-alias', instance);
  observability.setConfigSelector(() => 'worker-alias');
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    observability: exportSpans ? observability : undefined,
    workflows: { [workflow.id]: workflow, ...Object.fromEntries(nestedWorkflows.map(child => [child.id, child])) },
  });
  return { mastra, storage, pubsub, workflow, nestedWorkflow };
}

if (process.argv[2] === 'worker' || process.argv[2]?.startsWith('caller')) {
  const [, , , dbUrl, socketPath, eventsPath, mode, runId, gatePath] = process.argv;
  if (!dbUrl || !socketPath || !eventsPath || !mode) throw new Error('Missing worker arguments');
  const host = buildEventedOutcomeHost(dbUrl, socketPath, eventsPath, mode as RemoteOutcomeMode, gatePath);
  if (process.argv[2]?.startsWith('caller')) {
    await host.storage.init();
    const run = await host.workflow.createRun({ runId });
    if (process.argv[2] === 'caller-start') {
      void run.start({ inputData: {} }).catch(error => process.send?.({ type: 'error', message: String(error) }));
    } else {
      await run.startAsync({ inputData: {} });
    }
  } else {
    await host.mastra.startWorkers();
  }
  process.send?.({ type: 'ready' });
  process.once(
    'SIGTERM',
    () =>
      void (async () => {
        await host.mastra.shutdown();
        await host.pubsub.close();
        await host.storage.close();
        process.exit(0);
      })(),
  );
}
