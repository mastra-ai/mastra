import { task } from '@renderinc/sdk/workflows';
import type { TaskDefinition } from '@renderinc/sdk/workflows';
import type { Mastra } from '@mastra/core/mastra';
import { executeRemoteStep } from './context.js';
import { RenderProtocolError } from './errors.js';
import { parseEnvelope, rootEnvelopeSchema, stepEnvelopeSchema } from './protocol.js';
import { workflowBindings, type WorkflowBinding } from './provider.js';
import { withTaskRuntime } from './runtime-internal.js';
import { assertAncestors, verifyDispatch } from './authorization.js';
import { nativeIdentity } from './native.js';
import { executeCoordinator } from './coordinator.js';

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
  const roots = Object.values(mastra.listWorkflows())
    .map(workflow => workflowBindings.get(workflow))
    .filter((binding): binding is WorkflowBinding => !!binding);
  const discovered = new Set<WorkflowBinding>();
  const visit = (binding: WorkflowBinding) => {
    if (discovered.has(binding)) return;
    discovered.add(binding);
    for (const child of binding.manifest().nested.values()) visit(child);
  };
  roots.forEach(visit);
  const bindings = [...discovered];
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
    // Nested graphs need the same agents, storage and logger even when only their parent is listed in Mastra.
    binding.workflow.__registerMastra(mastra);
    binding.workflow.__registerPrimitives({ logger: mastra.getLogger() });
    const manifest = binding.manifest();
    for (const registered of manifest.steps.values()) {
      add(
        registered.name,
        task({ name: registered.name, ...registered.policy }, async (context, raw: unknown) => {
          const envelope = parseEnvelope(stepEnvelopeSchema, raw);
          check(binding, envelope);
          if (envelope.stepKey !== registered.key) throw new RenderProtocolError('Step identity mismatch');
          const assertAuthorized = async () => {
            const record = await binding.provider.store.get(envelope.workflowId, envelope.runId);
            verifyDispatch(envelope, record);
            const native = nativeIdentity(context, binding.provider.localDevelopment);
            if (
              native &&
              (native.parentTaskRunId !== record!.providerId || native.rootTaskRunId !== record!.rootProviderId)
            )
              throw new RenderProtocolError('Step native parent/root identity mismatch');
            await assertAncestors(binding.provider.store, record!);
          };
          await assertAuthorized();
          const result = await withTaskRuntime({ context, tasks: definitions, run: envelope }, () =>
            executeRemoteStep(registered.step, envelope, mastra, binding.provider.contextKeys),
          );
          await assertAuthorized();
          return result;
        }),
      );
    }
    add(
      manifest.rootName,
      task({ name: manifest.rootName, ...binding.rootPolicy }, async (context, raw: unknown) => {
        const envelope = parseEnvelope(rootEnvelopeSchema, raw);
        check(binding, envelope);
        return executeCoordinator(binding, context, envelope, definitions, mastra);
      }),
    );
  }
  return definitions;
}
