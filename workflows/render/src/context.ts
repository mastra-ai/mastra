import { RequestContext } from '@mastra/core/request-context';
import type { Mastra } from '@mastra/core/mastra';
import type { Step } from '@mastra/core/workflows';
import { RenderProtocolError, unsupported } from './errors.js';
import { json, type StepEnvelope, type StepOutcome } from './protocol.js';

const unavailable = new Set([
  'retryCount',
  'runCount',
  'suspend',
  'bail',
  'abort',
  'abortSignal',
  'writer',
  'outputWriter',
  'resume',
  'resumeData',
  'suspendData',
  'restart',
  'timeTravel',
  'actor',
  'engine',
  'tracingContext',
]);

/** Mapping and routing run in the root and must be pure transformations. */
export function pureContext<T extends object>(context: T): T {
  return new Proxy(context, {
    /** Expose supported context members while enforcing this execution context's mutation and capability restrictions. */
    get(target, property, receiver) {
      if (unavailable.has(String(property)) || property === 'setState')
        return unsupported(`local mapping or condition context.${String(property)}`);
      const value: unknown = Reflect.get(target, property, receiver);
      if (property === 'state' || property === 'inputData') return value === undefined ? value : freeze(json(value));
      if (property === 'getInitData' || property === 'getStepResult') {
        return (...args: unknown[]) => {
          const result: unknown = (value as (...args: unknown[]) => unknown)(...args);
          return result === undefined ? result : freeze(json(result));
        };
      }
      if (property === 'requestContext') {
        const source = value as RequestContext<unknown>;
        const copy = new RequestContext<unknown>(
          [...source.entries()].map(([key, entry]) => [key, freeze(json(entry))]),
        );
        return new Proxy(copy, {
          /** Expose supported context members while enforcing this execution context's mutation and capability restrictions. */
          get(object, key) {
            if (['set', 'setRaw', 'delete', 'deleteRaw', 'clear'].includes(String(key)))
              return () => unsupported('request-context mutation in a mapping or condition');
            const method: unknown = Reflect.get(object, key);
            return typeof method === 'function' ? method.bind(object) : method;
          },
        });
      }
      return value;
    },
  });
}

/** Recursively freeze validated JSON copies to prevent shared state mutation. */
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Copy only explicitly allowlisted JSON context entries; reject unknown keys before dispatch. */
export function encodeRequestContext(
  context: { entries(): IterableIterator<[unknown, unknown]> },
  allowed: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, value] of context.entries()) {
    if (typeof key !== 'string' || !allowed.includes(key))
      throw new RenderProtocolError(`Request context key ${String(key)} is not allowlisted`);
    result[key] = json(value, `requestContext.${key}`);
  }
  return result;
}

/** Validate a value through its Standard Schema and report boundary failures as protocol errors. */
export async function validate(
  schema: Step['inputSchema'] | undefined,
  value: unknown,
  label: string,
): Promise<unknown> {
  if (!schema) return value;
  const result = await schema['~standard'].validate(value);
  if (result.issues) throw new RenderProtocolError(`${label}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

/** Validate a child envelope and execute its step with supported Mastra context and guarded state updates. */
export async function executeRemoteStep(
  step: Step,
  envelope: StepEnvelope,
  mastra: Mastra | undefined,
  allowed: readonly string[],
): Promise<StepOutcome> {
  const inputData = json(await validate(step.inputSchema, envelope.input, 'step input'));
  const initialState = json(await validate(step.stateSchema, envelope.state, 'step state'));
  const requestContext = new RequestContext<unknown>(Object.entries(envelope.requestContext));
  encodeRequestContext(requestContext, allowed);
  await validate(step.requestContextSchema, envelope.requestContext, 'step request context');
  let state = initialState;
  let stateChanged = false;
  const writable = () => {
    if (envelope.readOnly) unsupported('shared state or request-context mutation inside parallel, branch or foreach');
  };
  const contextProxy = new Proxy(requestContext, {
    /** Expose supported context members while enforcing this execution context's mutation and capability restrictions. */
    get(target, property) {
      if (['set', 'setRaw', 'delete', 'deleteRaw', 'clear'].includes(String(property))) {
        return (key?: string, value?: unknown) => {
          writable();
          if (property === 'clear') return target.clear();
          if (!key || !allowed.includes(key))
            throw new RenderProtocolError(`Request context key ${key} is not allowlisted`);
          if (property === 'delete' || property === 'deleteRaw') return target.deleteRaw(key);
          target.setRaw(key, freeze(json(value, `requestContext.${key}`)));
        };
      }
      const value: unknown = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  for (const [key, value] of requestContext.entries()) requestContext.setRaw(key, freeze(json(value)));
  const supported = {
    runId: envelope.runId,
    workflowId: envelope.workflowId,
    resourceId: envelope.resourceId,
    inputData,
    state: freeze(initialState),
    requestContext: contextProxy,
    mastra,
    setState: async (next: unknown) => {
      writable();
      state = json(await validate(step.stateSchema, next, 'step state'));
      stateChanged = true;
    },
    getInitData: () => freeze(json(envelope.initialInput)),
    getStepResult: (target: string | { id: string }) => {
      const key = typeof target === 'string' ? target : target.id;
      return Object.hasOwn(envelope.priorOutputs, key) ? freeze(json(envelope.priorOutputs[key])) : null;
    },
  };
  const context = new Proxy(supported, {
    /** Expose supported context members while enforcing this execution context's mutation and capability restrictions. */
    get(target, property, receiver) {
      if (unavailable.has(String(property))) return unsupported(`remote step context.${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
  });
  // The framework Step interface includes control methods deliberately excluded from our factory's input type.
  // Runtime access guards above also protect steps supplied through core createStep instead of our factory.
  const output = await step.execute(context as Parameters<Step['execute']>[0]);
  const validated = json(await validate(step.outputSchema, output, 'step output'));
  return { output: validated, stateChanged, state, requestContext: encodeRequestContext(requestContext, allowed) };
}
