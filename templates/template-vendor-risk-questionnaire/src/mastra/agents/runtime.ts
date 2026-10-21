import { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import type { z } from 'zod';
import { boundedModel, providerOptions } from '../processing/model.ts';
import { canonicalJson } from '../intake/source.ts';

type ModelOptions = Parameters<typeof boundedModel>[0];
interface Capability {
  options: ModelOptions;
  model: ReturnType<typeof boundedModel>;
  identity: unknown[];
}
// Object identity is minted only inside the backend. Serialized RequestContext fields grant no access.
const capabilities = new WeakMap<RequestContext, Map<string, Capability>>();
const identityKeys = ['runId', 'questionId', 'organizationId', 'policyVersion'];
function capability(agentId: string, context?: RequestContext) {
  const bound = context && capabilities.get(context)?.get(agentId);
  if (!bound || canonicalJson(identityKeys.map(key => context!.get(key))) !== canonicalJson(bound.identity))
    throw new Error('RUNTIME_CAPABILITY_REQUIRED');
  return bound;
}
function bindPhaseAgent(agent: Agent, options: ModelOptions, context: RequestContext) {
  if (context.get('runId') !== options.runId || context.get('questionId') !== options.questionId)
    throw new Error('RUNTIME_CAPABILITY_SCOPE');
  const bindings = capabilities.get(context) ?? new Map<string, Capability>();
  bindings.set(agent.id, {
    options,
    model: boundedModel(options),
    identity: identityKeys.map(key => context.get(key)),
  });
  capabilities.set(context, bindings);
  return agent;
}
// Every business phase uses one tool-free structured response. Keep binding and
// native generation options together so review and drafting use the same boundary.
export async function generatePhase<T extends z.ZodType>(
  agent: Agent,
  options: ModelOptions,
  requestContext: RequestContext,
  prompt: string,
  schema: T,
) {
  const bound = bindPhaseAgent(
    agent,
    { ...options, validateOutput: options.validateOutput ?? (value => schema.parse(value)) },
    requestContext,
  );
  const response = await bound.generate(prompt, {
    requestContext,
    structuredOutput: { schema, errorStrategy: 'strict' },
    maxSteps: 1,
    toolChoice: 'none',
    modelSettings: { maxRetries: 0 },
    providerOptions,
  });
  return schema.parse(response.object);
}
export function createPhaseAgent(id: string, name: string, instructions: string, phase: ModelOptions['phase']) {
  return new Agent({
    id,
    name,
    instructions,
    maxRetries: 0,
    defaultOptions: { tracingOptions: { hideInput: true, hideOutput: true } },
    model: async ({ requestContext }) => {
      const bound = capability(id, requestContext);
      const status = await bound.options.store.status(bound.options.runId);
      if (
        !status ||
        bound.options.phase !== phase ||
        canonicalJson(status.run.policy) !== canonicalJson(bound.options.policy)
      )
        throw new Error('RUNTIME_CAPABILITY_SCOPE');
      return bound.model;
    },
    inputProcessors: [
      {
        id: 'trusted-runtime-capability',
        processInput: ({ requestContext, messages }) => {
          capability(id, requestContext);
          return messages;
        },
      },
    ],
  });
}
