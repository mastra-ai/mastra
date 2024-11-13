import { Mastra } from '../framework';
import { z } from 'zod';
import { listAgentsJson } from './utils';

export function getAgentSystemApis({ mastra }: { mastra: Mastra }) {
  const agentDir = mastra.config.agents.agentDirPath;
  const agents = listAgentsJson({ agentDir });

  // Remove the .json extension from the agent names
  let agentList: string[] = [];
  if (agents) {
    agentList = agents.map((agent) => agent.slice(0, -5));
  }

  return [
    {
      integrationName: mastra.config.name,
      type: 'message_agent',
      label: 'Send Message To Agent',
      description: 'Sends a message to an Agent',
      schema: z.object({
        agentId: z.enum(agentList as [string, ...string[]]),
        message: z.string(),
      }),
      outputSchema: z.object({
        message: z.string(),
      }),
      executor: async ({ data, ctx }: any) => {
        const executor = await mastra.getAgent({
          agentId: data.agentId,
          connectionId: ctx.connectionId,
        });

        if (!executor) {
          throw new Error('Could not create agent executor');
        }

        if (typeof executor === 'function') {
          const result = await executor({ prompt: data?.message });

          let answer: any;

          if (Array.isArray(result.toolCalls)) {
            answer = result.toolCalls?.find(
              ({ toolName }) => toolName === 'answer'
            );
          }

          return {
            message: result?.text,
            answer: answer?.args,
          };
        } else {
          const thread = await executor.initializeThread([
            { role: 'user', content: data?.message },
          ]);

          const run = await executor.watchRun({ threadId: thread.id });

          const message = run?.content?.[0]?.text?.value;
          const answer = run?.content?.find(
            (m: any) => m.toolName === 'answer'
          )?.args;
          return {
            message,
            answer,
          };
        }
      },
    },
  ];
}
