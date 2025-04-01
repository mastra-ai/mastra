import { isVercelTool } from '@mastra/core/tools';
import type { ToolAction, VercelTool } from '@mastra/core/tools';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface ToolsContext extends Context {
  tools?: Record<string, ToolAction | VercelTool>;
  toolId?: string;
  runId?: string;
}

// Tool handlers
export async function getToolsHandler({ tools }: Pick<ToolsContext, 'tools'>) {
  try {
    if (!tools) {
      return {};
    }

    const serializedTools = Object.entries(tools).reduce(
      (acc, [id, _tool]) => {
        const tool = _tool as any;
        acc[id] = {
          ...tool,
          inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
          outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    return serializedTools;
  } catch (error) {
    return handleError(error, 'Error getting tools');
  }
}

export async function getToolByIdHandler({ tools, toolId }: Pick<ToolsContext, 'tools' | 'toolId'>) {
  try {
    const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;

    if (!tool) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    const serializedTool = {
      ...tool,
      inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
      outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
    };

    return serializedTool;
  } catch (error) {
    return handleError(error, 'Error getting tool');
  }
}

export function executeToolHandler(tools: ToolsContext['tools']) {
  return async ({
    mastra,
    runId,
    toolId,
    data,
  }: Pick<ToolsContext, 'mastra' | 'toolId' | 'runId'> & { data?: unknown }) => {
    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      const tool = Object.values(tools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      if (!tool?.execute) {
        throw new HTTPException(400, { message: 'Tool is not executable' });
      }

      validateBody({ data });

      if (isVercelTool(tool)) {
        const result = await (tool as any).execute(data);
        return result;
      }

      const result = await tool.execute({
        context: data!,
        mastra,
        runId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  };
}

export async function executeAgentToolHandler({
  mastra,
  agentId,
  toolId,
  data,
}: Pick<ToolsContext, 'mastra' | 'toolId'> & { agentId?: string; data: any }) {
  try {
    const agent = agentId ? mastra.getAgent(agentId) : null;
    if (!agent) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    const tool = Object.values(agent?.tools || {}).find((tool: any) => tool.id === toolId) as any;

    if (!tool) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    if (!tool?.execute) {
      throw new HTTPException(400, { message: 'Tool is not executable' });
    }

    // if (isVercelTool(tool)) {
    //   const result = await (tool as any).execute(data);
    //   return result;
    // }

    const result = await tool.execute({
      context: data,
      mastra,
      runId: agentId,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error executing tool');
  }
}
