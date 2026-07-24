import type { Agent } from '../agent';
import type { Mastra } from '../mastra';
import { RequestContext } from '../request-context';

const PROCESSOR_AGENT_REF_KEY = '__mastra_processor_agent_ref';
const PROCESSOR_AGENT_ID_KEY = '__mastra_processor_agent_id';

type ProcessorAgent = Agent<any, any, any, any>;
type AgentGetter = () => ProcessorAgent;

/**
 * Creates an isolated per-run context for processor workflows.
 *
 * The getter is deliberately a function: RequestContext excludes functions from
 * JSON serialization, while the agent ID can safely cross an evented boundary.
 */
export function createProcessorWorkflowRequestContext(
  requestContext: RequestContext | undefined,
  agent: ProcessorAgent | undefined,
): RequestContext {
  const child = new RequestContext(requestContext?.entries());
  if (agent) {
    child.set(PROCESSOR_AGENT_REF_KEY, (() => agent) satisfies AgentGetter);
    child.set(PROCESSOR_AGENT_ID_KEY, agent.id);
  }
  return child;
}

export async function resolveProcessorAgent({
  requestContext,
  mastra,
  boundAgent,
}: {
  requestContext?: RequestContext;
  mastra?: Mastra;
  boundAgent?: ProcessorAgent;
}): Promise<ProcessorAgent | undefined> {
  if (boundAgent) {
    return boundAgent;
  }

  const getAgent = requestContext?.get<string, AgentGetter>(PROCESSOR_AGENT_REF_KEY);
  if (typeof getAgent === 'function') {
    return getAgent();
  }

  const agentId = requestContext?.get<string, string>(PROCESSOR_AGENT_ID_KEY);
  if (!agentId || !mastra) {
    return undefined;
  }

  try {
    const registeredAgent = await mastra.getAgentById(agentId);
    return (registeredAgent as any).agent ?? registeredAgent;
  } catch {
    return undefined;
  }
}
