import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { boundedModel } from '../processing/model.ts';
import { canonicalJson } from '../intake/source.ts';

type ModelOptions = Parameters<typeof boundedModel>[0];
interface Capability {
  options: ModelOptions;
  model: ReturnType<typeof boundedModel>;
  tools: ToolsInput;
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
export function bindPhaseAgent(agent: Agent, options: ModelOptions, context: RequestContext, tools: ToolsInput = {}) {
  if (context.get('runId') !== options.runId || context.get('questionId') !== options.questionId)
    throw new Error('RUNTIME_CAPABILITY_SCOPE');
  const bindings = capabilities.get(context) ?? new Map<string, Capability>();
  bindings.set(agent.id, {
    options,
    model: boundedModel(options),
    tools,
    identity: identityKeys.map(key => context.get(key)),
  });
  capabilities.set(context, bindings);
  return agent;
}
export function createPhaseAgent(id: string, name: string, instructions: string, phase: ModelOptions['phase']) {
  return new Agent({
    id,
    name,
    instructions,
    maxRetries: 0,
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
    tools: ({ requestContext }) => capability(id, requestContext).tools,
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
