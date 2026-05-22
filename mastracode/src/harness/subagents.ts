import { Agent } from '@mastra/core/agent';
import type { PubSub } from '@mastra/core/events';
import type { HarnessSubagent } from '@mastra/core/harness';
import type { MastraMemory } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { DynamicArgument } from '@mastra/core/types';

export function createHarnessV1SubagentAgents(
  subagents: HarnessSubagent[],
  resolveModel: (ctx: { requestContext: RequestContext }) => unknown,
  services: { memory?: DynamicArgument<MastraMemory>; pubsub?: PubSub } = {},
): Record<string, Agent> {
  return Object.fromEntries(
    subagents.map(subagent => {
      const agent = new Agent({
        id: `subagent-${subagent.id}`,
        name: subagent.name,
        instructions: subagent.instructions,
        model: resolveModel as never,
        tools: subagent.tools,
      });
      if (services.memory && !(agent as any).hasOwnMemory?.()) {
        (agent as any).__setMemory?.(services.memory);
      }
      if (services.pubsub && !(agent as any).hasOwnPubSub?.()) {
        (agent as any).__setPubSub?.(services.pubsub);
      }
      return [`subagent-${subagent.id}`, agent] as const;
    }),
  );
}
