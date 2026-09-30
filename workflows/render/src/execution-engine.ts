import { AsyncLocalStorage } from 'node:async_hooks';
import { DefaultExecutionEngine } from '@mastra/core/workflows';
import { encodeRequestContext, pureContext } from './context.js';
import { RenderProtocolError } from './errors.js';
import { coordinatorRuntime, dispatchChild, inheritedReadOnly, logicalRunId } from './runtime-internal.js';
import { executeNested, NestedExecutionError } from './nested.js';
import { json, parseEnvelope, PROTOCOL_VERSION, stepOutcomeSchema, type StepEnvelope } from './protocol.js';
import type { Manifest } from './manifest.js';

interface EngineBinding {
  buildId: string;
  allowedContext: readonly string[];
  manifest(): Manifest;
}
const localMapping = new AsyncLocalStorage<boolean>();
const readOnly = new AsyncLocalStorage<boolean>();
const nestedInvocation = new AsyncLocalStorage<Parameters<DefaultExecutionEngine['executeStep']>[0]>();

export class RenderExecutionEngine extends DefaultExecutionEngine {
  /** Bind Mastra's graph engine to the worker manifest and allowed request-context keys. */
  constructor(
    private readonly binding: EngineBinding,
    options: ConstructorParameters<typeof DefaultExecutionEngine>[0],
  ) {
    super(options);
  }

  override async invokeStartCallback(info: Parameters<DefaultExecutionEngine['invokeStartCallback']>[0]) {
    await coordinatorRuntime().assertActive();
    return super.invokeStartCallback({ ...info, runId: logicalRunId(info.runId) });
  }

  override async invokeLifecycleCallbacks(info: Parameters<DefaultExecutionEngine['invokeLifecycleCallbacks']>[0]) {
    await coordinatorRuntime().assertActive();
    return super.invokeLifecycleCallbacks({ ...info, runId: logicalRunId(info.runId) });
  }

  /** Keep mappings local and dispatch business steps with signed, JSON-safe execution context. */
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
    if (manifest.nested.has(params.step.id)) return nestedInvocation.run(params, () => super.executeStep(params));
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
            runId: logicalRunId(params.runId),
            ...(params.resourceId === undefined ? {} : { resourceId: params.resourceId }),
            buildId: this.binding.buildId,
            manifest: manifest.hash,
            stepKey: registered.key,
            executionKey: JSON.stringify([
              params.runId,
              params.executionContext.executionPath,
              params.executionContext.foreachIndex ?? null,
              params.step.id,
              params.iterationCount ?? null,
            ]),
            input: json(context.inputData),
            state: json(context.state),
            requestContext: encodeRequestContext(context.requestContext, this.binding.allowedContext),
            initialInput: json(context.getInitData()),
            priorOutputs,
            readOnly: inheritedReadOnly() || (readOnly.getStore() ?? false),
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

  override isNestedWorkflowStep(step: Parameters<DefaultExecutionEngine['isNestedWorkflowStep']>[0]): boolean {
    return this.binding.manifest().nested.has(step.id);
  }

  /** Keep Mastra's step bookkeeping while invoking a native child coordinator. */
  override async executeWorkflowStep(params: Parameters<DefaultExecutionEngine['executeWorkflowStep']>[0]) {
    const invocation = nestedInvocation.getStore();
    const child = this.binding.manifest().nested.get(params.step.id);
    if (!child || !invocation) throw new RenderProtocolError('Missing nested workflow invocation');
    try {
      const outcome = await executeNested(child, {
        input: params.inputData,
        state: params.executionContext.state,
        requestContext: encodeRequestContext(params.requestContext, this.binding.allowedContext),
        readOnly: inheritedReadOnly() || (readOnly.getStore() ?? false),
        executionKey: JSON.stringify([
          invocation.executionContext.executionPath,
          invocation.executionContext.foreachIndex ?? null,
          params.step.id,
          invocation.iterationCount ?? null,
        ]),
        resourceId: invocation.resourceId,
      });
      params.executionContext.state = json(outcome.result.state) as typeof params.executionContext.state;
      params.requestContext.clear();
      for (const [key, value] of Object.entries(outcome.requestContext)) params.requestContext.setRaw(key, value);
      return {
        status: 'success' as const,
        output: outcome.result.result,
        payload: params.inputData,
        metadata: { nestedRunId: outcome.snapshotRunId },
        startedAt: params.startedAt,
        endedAt: Date.now(),
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        error: error instanceof Error ? error : new Error(String(error)),
        ...(error instanceof NestedExecutionError && error.snapshotRunId
          ? { metadata: { nestedRunId: error.snapshotRunId } }
          : {}),
        payload: params.inputData,
        startedAt: params.startedAt,
        endedAt: Date.now(),
      };
    }
  }

  /** Execute pure mappings in the coordinator rather than creating native task definitions. */
  override executeMapping(params: Parameters<DefaultExecutionEngine['executeMapping']>[0]) {
    return localMapping.run(true, () => super.executeMapping(params));
  }
  /** Run parallel branches with shared state and request-context mutation disabled. */
  override executeParallel(params: Parameters<DefaultExecutionEngine['executeParallel']>[0]) {
    return readOnly.run(true, () => super.executeParallel(params));
  }
  /** Evaluate pure branch conditions and keep selected branch state read-only. */
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
  /** Use Mastra's iteration scheduling while preventing shared mutation between items. */
  override executeForeach(params: Parameters<DefaultExecutionEngine['executeForeach']>[0]) {
    return readOnly.run(true, () => super.executeForeach(params));
  }
  /** Preserve Mastra loop scheduling and expose a pure context to each loop condition. */
  override executeLoop(params: Parameters<DefaultExecutionEngine['executeLoop']>[0]) {
    return super.executeLoop({
      ...params,
      entry: {
        ...params.entry,
        condition: (context, ...rest) => params.entry.condition(pureContext(context), ...rest),
      },
    });
  }
}
