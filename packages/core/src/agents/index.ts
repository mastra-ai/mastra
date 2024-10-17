import { z } from 'zod';

import { getAssistantAgent } from './openai/assistant';
import { createAgent, createStreamAgent } from './vercel';
import { IntegrationApi } from '../types';

export async function getAgent({
  connectionId,
  agent,
  apis,
}: {
  connectionId: string;
  agent: Record<string, any>;
  apis: Record<string, IntegrationApi>;
}) {
  console.log('get agent start, model provider====', agent.model.provider);
  if (agent.model.provider?.toUpperCase() === 'OPEN_AI_ASSISTANT') {
    console.log('===in the model if block===');
    const tools = Object.keys(agent.tools);
    const toolMap = Object.entries(apis).reduce((memo, [k, def]) => {
      if (tools.includes(k)) {
        console.log(`${k} tool included, run executorx====`);
        memo[k] = async (props: any) => {
          return def.executor({
            data: props,
            ctx: { connectionId },
          });
        };
      }
      return memo;
    }, {} as Record<string, any>);

    console.log('toolmap====', JSON.stringify(toolMap, null, 2));

    const assistant = await getAssistantAgent({
      id: agent.id,
      toolMap,
      tool_choice: agent.model.toolChoice,
    });
    console.log('got assistant===', assistant);
    return assistant;
  } else if (
    [
      'OPEN_AI_VERCEL',
      'ANTHROPIC_VERCEL',
      'GROQ_VERCEL',
      'PERPLEXITY_VERCEL',
      'FIREWORKS_VERCEL',
    ].includes(agent.model.provider?.toUpperCase())
  ) {
    const keyToModel: Record<string, string> = {
      OPEN_AI_VERCEL: 'openai',
      ANTHROPIC_VERCEL: 'anthropic',
      GROQ_VERCEL: 'groq',
      PERPLEXITY_VERCEL: 'perplexity',
      FIREWORKS_VERCEL: 'fireworks',
    };

    const tools = Object.keys(agent.tools);

    const toolMap = Object.entries(apis).reduce((memo, [k, def]) => {
      if (tools.includes(k)) {
        memo[k] = {
          description: def.label,
          parameters: def.schema,
          execute: async (props: any) => {
            return def.executor({
              data: props,
              ctx: { connectionId },
            });
          },
        };
      }
      return memo;
    }, {} as Record<string, any>);

    let resultTool = undefined;

    if (agent.outputs.structured) {
      const schema = Object.entries(
        agent.outputs.structured.schema as Record<string, any>
      ).reduce((memo, [k, v]) => {
        if (v.type === 'string') {
          memo[k] = z.string();
        }
        if (v.type === 'array') {
          const itemType = v?.items?.type;
          if (itemType === 'string') {
            memo[k] = z.array(z.string());
          }
        }
        return memo;
      }, {} as Record<string, any>);

      resultTool = {
        description: agent.outputs.structured.description,
        parameters: z.object(schema),
      };
    }

    if (agent.model.generation_type === 'stream') {
      return createStreamAgent({
        agent_instructions: agent.agent_instructions,
        model: {
          type: keyToModel[agent.model.provider],
          name: agent.model.name,
          toolChoice: agent.model?.toolChoice || 'required',
        },
        tools: toolMap,
        resultTool,
      });
    }

    return createAgent({
      agent_instructions: agent.agent_instructions,
      model: {
        type: keyToModel[agent.model.provider],
        name: agent.model.name,
        toolChoice: agent.model?.toolChoice || 'required',
      },
      tools: toolMap,
      resultTool,
    });
  }
}

export * from './utils';
export * from './vector-sync';
export * from './openai/assistant';
export * from './vercel';
