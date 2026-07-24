import { MASTRA_IS_STUDIO_KEY, isReservedRequestContextKey } from '../constants';
import { HTTPException } from '../http-exception';
import { agentExecutionBodySchema, streamResponseSchema } from '../schemas/agents';
import { workflowBuilderSettingsResponseSchema } from '../schemas/workflow-builder';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { enforceThreadAccess, getEffectiveResourceId, getEffectiveThreadId, validateBody } from './utils';

export const GET_WORKFLOW_BUILDER_SETTINGS_ROUTE = createRoute({
  method: 'GET',
  path: '/editor/workflow-builder/settings',
  responseType: 'json',
  responseSchema: workflowBuilderSettingsResponseSchema,
  summary: 'Get persisted workflow builder settings',
  description: 'Returns whether the editor-owned persisted workflow builder is available',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:read',
  handler: async ({ mastra }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor || typeof editor.resolveWorkflowBuilder !== 'function') return { enabled: false };
      if (!editor.hasEnabledWorkflowBuilderConfig?.()) return { enabled: false };

      const builder = await editor.resolveWorkflowBuilder();
      return {
        enabled: builder?.enabled === true,
        modelPolicy: builder?.getModelPolicy(),
      };
    } catch (error) {
      return handleError(error, 'Error getting workflow builder settings');
    }
  },
});

export const STREAM_WORKFLOW_BUILDER_ROUTE = createRoute({
  method: 'POST',
  path: '/editor/workflow-builder/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream persisted workflow builder response',
  description: 'Streams from the hidden editor-owned workflow builder agent',
  tags: ['Editor'],
  requiresAuth: true,
  requiresPermission: 'stored-workflows:write',
  handler: async ({ mastra, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor?.hasEnabledWorkflowBuilderConfig?.() || typeof editor.resolveWorkflowBuilder !== 'function') {
        throw new HTTPException(404, { message: 'Workflow builder is not enabled' });
      }

      const builder = await editor.resolveWorkflowBuilder();
      if (!builder?.enabled) throw new HTTPException(404, { message: 'Workflow builder is not enabled' });
      const agent = builder.getAgent();

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, ...rest } = params;
      validateBody({ messages });

      if (bodyRequestContext && typeof bodyRequestContext === 'object') {
        for (const [key, value] of Object.entries(bodyRequestContext)) {
          if (!isReservedRequestContextKey(key) && key !== MASTRA_IS_STUDIO_KEY) {
            serverRequestContext.set(key, value);
          }
        }
      }

      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;
        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

        if (effectiveThreadId) {
          const memory = await agent.getMemory({ requestContext: serverRequestContext });
          const thread = await memory?.getThreadById({ threadId: effectiveThreadId });
          if (thread) {
            await enforceThreadAccess({
              mastra,
              requestContext: serverRequestContext,
              threadId: effectiveThreadId,
              thread,
              effectiveResourceId,
              permission: 'memory:write',
            });
          }
        }

        authorizedMemoryOption = {
          ...memoryOption,
          resource: effectiveResourceId ?? memoryOption.resource,
          thread: effectiveThreadId ?? memoryOption.thread,
        };
      }

      const { structuredOutput, ...streamOptions } = rest;
      const options: Record<string, any> = {
        ...streamOptions,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };
      const result = structuredOutput
        ? await agent.stream(messages, { ...options, structuredOutput })
        : await agent.stream(messages, options);
      return result.fullStream;
    } catch (error) {
      return handleError(error, 'Error streaming workflow builder response');
    }
  },
});
