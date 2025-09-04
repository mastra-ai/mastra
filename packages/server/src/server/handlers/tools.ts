import type { RuntimeContext } from '@mastra/core/di';
import type { ToolAction, VercelTool } from '@mastra/core/tools';
import { isVercelTool } from '@mastra/core/tools';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
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
    runtimeContext,
  }: Pick<ToolsContext, 'mastra' | 'toolId' | 'runId'> & {
    data?: unknown;
    runtimeContext: RuntimeContext;
  }) => {
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
        runtimeContext,
        // TODO: Pass proper tracing context when server API supports tracing
        tracingContext: { currentSpan: undefined },
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  };
}

export async function getAgentToolHandler({
  mastra,
  agentId,
  toolId,
  runtimeContext,
}: Pick<ToolsContext, 'mastra' | 'toolId'> & {
  agentId?: string;
  runtimeContext: RuntimeContext;
}) {
  try {
    const agent = agentId ? mastra.getAgent(agentId) : null;
    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }

    const agentTools = await agent.getTools({ runtimeContext });

    const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

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
    return handleError(error, 'Error getting agent tool');
  }
}

export async function executeAgentToolHandler({
  mastra,
  agentId,
  toolId,
  data,
  runtimeContext,
}: Pick<ToolsContext, 'mastra' | 'toolId'> & {
  agentId?: string;
  data: any;
  runtimeContext: RuntimeContext;
}) {
  try {
    const agent = agentId ? mastra.getAgent(agentId) : null;
    if (!agent) {
      throw new HTTPException(404, { message: 'Tool not found' });
    }

    const agentTools = await agent.getTools({ runtimeContext });

    const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

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
      runtimeContext,
      mastra,
      runId: agentId,
      // TODO: Pass proper tracing context when server API supports tracing
      tracingContext: { currentSpan: undefined },
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error executing tool');
  }
}
