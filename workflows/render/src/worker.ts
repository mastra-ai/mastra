import { task } from '@renderinc/sdk/workflows';
import { randomBytes } from 'node:crypto';
import type { TaskDefinition } from '@renderinc/sdk/workflows';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { executeRemoteStep } from './context.js';
import { RenderProtocolError, errorRecord } from './errors.js';
import { frameworkJson, parseEnvelope, rootEnvelopeSchema, stepEnvelopeSchema } from './protocol.js';
import { terminal, updateRun } from './persistence/types.js';
import { workflowBindings, type WorkflowBinding } from './provider.js';
import { RenderRun } from './run.js';
import { withTaskRuntime, createDispatchLimiter } from './runtime-internal.js';
import { authorizeDispatch, submissionHash, verifyDispatch } from './authorization.js';

/** Import application definitions first, then register synchronously before SDK autostart. */
export function registerRenderTasks({
  mastra,
  nativeTasks = [],
}: {
  mastra: Mastra;
  /** Definitions already registered with the SDK task() function at worker startup. */
  nativeTasks?: readonly { name: string }[];
}): ReadonlyMap<string, TaskDefinition<[unknown], unknown>> {
  const definitions = new Map<string, TaskDefinition<[unknown], unknown>>();
  const bindings = Object.values(mastra.listWorkflows())
    .map(workflow => workflowBindings.get(workflow))
    .filter((binding): binding is WorkflowBinding => !!binding);
  const count = bindings.reduce((sum, binding) => sum + binding.manifest().steps.size + 1, nativeTasks.length);
  if (count > 500) throw new RenderProtocolError('Generated Render task count exceeds 500');
  const names = new Set<string>();
  for (const name of [
    ...nativeTasks.map(item => item.name),
    ...bindings.flatMap(binding => [
      binding.manifest().rootName,
      ...[...binding.manifest().steps.values()].map(step => step.name),
    ]),
  ]) {
    if (names.has(name)) throw new RenderProtocolError(`Task name collision ${name}`);
    names.add(name);
  }
  const check = (binding: WorkflowBinding, envelope: { manifest: string; buildId: string; workflowId: string }) => {
    if (
      envelope.manifest !== binding.manifest().hash ||
      envelope.buildId !== binding.provider.options.buildId ||
      envelope.workflowId !== binding.workflow.id
    ) {
      throw new RenderProtocolError('Caller/worker manifest or build mismatch. Deploy matching application builds.');
    }
  };
  /** Add one native definition and reject duplicate task names before worker registration completes. */
  function add(name: string, definition: TaskDefinition<[unknown], unknown>) {
    if (definitions.has(name)) throw new RenderProtocolError(`Task name collision ${name}`);
    definitions.set(name, definition);
  }
  for (const binding of bindings) {
    const manifest = binding.manifest();
    for (const registered of manifest.steps.values()) {
      add(
        registered.name,
        task({ name: registered.name, ...registered.policy }, async (context, raw: unknown) => {
          const envelope = parseEnvelope(stepEnvelopeSchema, raw);
          check(binding, envelope);
          if (envelope.stepKey !== registered.key) throw new RenderProtocolError('Step identity mismatch');
          verifyDispatch(envelope, await binding.provider.store.get(envelope.workflowId, envelope.runId));
          return withTaskRuntime({ context, tasks: definitions, run: envelope }, () =>
            executeRemoteStep(registered.step, envelope, mastra, binding.provider.contextKeys),
          );
        }),
      );
    }
    add(
      manifest.rootName,
      task({ name: manifest.rootName, ...binding.rootPolicy }, async (context, raw: unknown) => {
        const envelope = parseEnvelope(rootEnvelopeSchema, raw);
        check(binding, envelope);
        const store = binding.provider.store;
        const record = await store.get(envelope.workflowId, envelope.runId);
        if (
          !record ||
          record.manifest !== envelope.manifest ||
          record.resourceId !== envelope.resourceId ||
          record.buildId !== envelope.buildId ||
          record.submissionHash !== submissionHash(envelope) ||
          record.status === 'cancel-requested' ||
          record.status === 'success' ||
          record.status === 'failed' ||
          record.status === 'canceled'
        ) {
          throw new RenderProtocolError('Missing, mismatched or terminal Mastra run binding');
        }
        const workerClaim = randomBytes(32).toString('hex');
        const claimed = await updateRun(store, envelope.workflowId, envelope.runId, current => {
          if (current.workerClaim) throw new RenderProtocolError('This Mastra run was already claimed by a root task');
          if (terminal(current.status) || current.status === 'cancel-requested')
            throw new RenderProtocolError('Mastra run is no longer accepting execution');
          return {
            workerClaim,
            status: 'running',
            dispatchClosed: false,
            dispatchExpiresAt: Date.now() + (binding.rootPolicy.timeoutSeconds ?? 7200) * 1000,
          };
        });
        if (claimed.workerClaim !== workerClaim || terminal(claimed.status))
          throw new RenderProtocolError('Run became terminal before worker claim');
        try {
          return await withTaskRuntime(
            {
              context,
              tasks: definitions,
              run: envelope,
              dispatch: createDispatchLimiter(binding.provider.options.maxConcurrentSteps ?? 16),
              authorize: value => authorizeDispatch(value, workerClaim),
            },
            async () => {
              const run = await binding.workflow.createRun({ runId: envelope.runId, resourceId: envelope.resourceId });
              if (!(run instanceof RenderRun))
                throw new RenderProtocolError('Worker workflow is not a Render workflow');
              const result = await run.executeLocal({
                inputData: envelope.input,
                initialState: envelope.state,
                requestContext: new RequestContext<unknown>(Object.entries(envelope.requestContext)),
              });
              const serialized = frameworkJson(result);
              await updateRun(store, envelope.workflowId, envelope.runId, current => ({
                result: serialized,
                dispatchClosed: true,
                // A lost submission response can leave this completed root without a native binding.
                ...(!current.providerId
                  ? {
                      status: result.status === 'success' ? ('success' as const) : ('failed' as const),
                    }
                  : {}),
                ...(result.status === 'failed' ? { error: errorRecord(result.error) } : {}),
              }));
              if (result.status !== 'success')
                throw new Error(`Mastra workflow ${envelope.workflowId} ${result.status}`);
              return serialized;
            },
          );
        } catch (error) {
          await updateRun(store, envelope.workflowId, envelope.runId, current => ({
            error: current.error ?? errorRecord(error),
            dispatchClosed: true,
            ...(!current.providerId ? { status: 'failed' as const } : {}),
          })).catch(() => console.error('[mastra-render] Failed to persist root error.'));
          throw error;
        } finally {
          await updateRun(store, envelope.workflowId, envelope.runId, () => ({ dispatchClosed: true })).catch(() =>
            console.error('[mastra-render] Failed to close child dispatch; authority expires at its deadline.'),
          );
        }
      }),
    );
  }
  return definitions;
}
