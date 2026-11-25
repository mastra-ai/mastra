import { z } from 'zod';
import { BillingError } from '../billing/contracts/core.js';
import { isPreparedBillingIntegration } from '../billing/integration.js';
import type { AnyAgent } from '../billing/mastra-resources.js';
import { StudioAgentRuntime } from './studio-agent-decorator.js';
import { studioChatProxy } from './studio-chat-proxy.js';
import { createStudioOperationTools } from './studio-operation-tools.js';
import type { StudioBillingIntegration, StudioServerWrapper } from './studio-wrapper-contracts.js';
export type { StudioBillingIntegration, StudioConversation, StudioServerWrapper } from './studio-wrapper-contracts.js';

/** Compose native conversation agents with prepared billing resources and existing identity. */
export function createStudioBillingWrapper(options: { integration: StudioBillingIntegration }) {
  const parsed = z
    .strictObject({ integration: z.custom<StudioBillingIntegration>(isPreparedBillingIntegration) })
    .safeParse(options);
  if (!parsed.success) throw new BillingError('invalid_configuration');
  const { integration } = parsed.data;
  const runtime = new StudioAgentRuntime(integration);
  const tools = createStudioOperationTools(runtime);
  return {
    integration,
    agents: runtime.agents,
    /** Return the same concrete Agent, preserving every public generic overload. */
    decorateAgent: <A extends AnyAgent>(agent: A): A => runtime.decorate(agent),
    agentTool: tools.agentTool,
    workflowTools: tools.workflowTools,
    registerAlias: (id: string, agent: AnyAgent) => runtime.alias(id, agent),
    middleware: (apiPrefix, fallback) => studioChatProxy(runtime, apiPrefix, fallback),
  } satisfies StudioServerWrapper & {
    decorateAgent<A extends AnyAgent>(agent: A): A;
    agentTool: typeof tools.agentTool;
    workflowTools: typeof tools.workflowTools;
  };
}
