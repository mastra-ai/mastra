import { AsyncLocalStorage } from 'node:async_hooks';
import { DefaultExecutionEngine } from '@mastra/core/workflows';
import { encodeRequestContext, pureContext } from './context.js';
import { RenderProtocolError } from './errors.js';
import { dispatchChild } from './runtime-internal.js';
import { json, parseEnvelope, PROTOCOL_VERSION, stepOutcomeSchema, type StepEnvelope } from './protocol.js';
import type { Manifest } from './manifest.js';

interface EngineBinding {
  buildId: string;
  allowedContext: readonly string[];
  manifest(): Manifest;
}
const localMapping = new AsyncLocalStorage<boolean>();
const readOnly = new AsyncLocalStorage<boolean>();

export class RenderExecutionEngine extends DefaultExecutionEngine {
  constructor(
    private readonly binding: EngineBinding,
    options: ConstructorParameters<typeof DefaultExecutionEngine>[0],
  ) {
    super(options);
  }

  override async executeStep(params: Parameters<DefaultExecutionEngine['executeStep']>[0]) {
    if (localMapping.getStore())
      return super.executeStep({
        ...params,
        step: {
          ...params.step,
          execute: async context => json(await params.step.execute(pureContext(context)), 'mapping output'),
        },
      });
    const manifest = this.binding.manifest();
    const registered = manifest.steps.get(params.step.id);
    if (!registered) throw new RenderProtocolError(`Step ${params.step.id} was not registered`);
    return super.executeStep({
      ...params,
      step: {
        ...params.step,
        retries: 0,
        execute: async context => {
          const priorOutputs: Record<string, unknown> = Object.create(null);
          for (const id of Object.keys(params.stepResults)) {
            if (id === 'input') continue;
            const value: unknown = context.getStepResult(id);
            if (value !== undefined) priorOutputs[id] = json(value, `prior output ${id}`);
          }
          const envelope: StepEnvelope = {
            version: PROTOCOL_VERSION,
            workflowId: params.workflowId,
            runId: params.runId,
            ...(params.resourceId === undefined ? {} : { resourceId: params.resourceId }),
            buildId: this.binding.buildId,
            manifest: manifest.hash,
            stepKey: registered.key,
            executionKey: JSON.stringify([
              params.runId,
              params.executionContext.executionPath,
              params.executionContext.foreachIndex ?? null,
              params.step.id,
            ]),
            input: json(context.inputData),
            state: json(context.state),
            requestContext: encodeRequestContext(context.requestContext, this.binding.allowedContext),
            initialInput: json(context.getInitData()),
            priorOutputs,
            readOnly: readOnly.getStore() ?? false,
          };
          json([envelope], 'task arguments');
          const outcome = parseEnvelope(stepOutcomeSchema, await dispatchChild(registered.name, envelope));
          if (outcome.stateChanged) await context.setState(outcome.state);
          context.requestContext.clear();
          for (const [key, value] of Object.entries(outcome.requestContext)) context.requestContext.setRaw(key, value);
          return outcome.output;
        },
      },
    });
  }

  override executeMapping(params: Parameters<DefaultExecutionEngine['executeMapping']>[0]) {
    return localMapping.run(true, () => super.executeMapping(params));
  }
  override executeParallel(params: Parameters<DefaultExecutionEngine['executeParallel']>[0]) {
    return readOnly.run(true, () => super.executeParallel(params));
  }
  override executeConditional(params: Parameters<DefaultExecutionEngine['executeConditional']>[0]) {
    return readOnly.run(true, () =>
      super.executeConditional({
        ...params,
        entry: {
          ...params.entry,
          conditions: params.entry.conditions.map(
            condition =>
              (context, ...rest) =>
                condition(pureContext(context), ...rest),
          ),
        },
      }),
    );
  }
  override executeForeach(params: Parameters<DefaultExecutionEngine['executeForeach']>[0]) {
    return readOnly.run(true, () => super.executeForeach(params));
  }
}
