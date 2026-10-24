import { SERVER_ERROR_CODES } from '../error-codes';
import { HTTPException } from '../http-exception';
import { agentExecutionBodySchema, streamResponseSchema } from '../schemas/agents';
import { workflowBuilderSettingsResponseSchema } from '../schemas/workflow-builder';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import {
  applyEffectiveThreadId,
  enforceThreadAccess,
  getEffectiveResourceId,
  getEffectiveThreadId,
  mergeBodyRequestContext,
  requireEffectiveResourceId,
  validateBody,
} from './utils';

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
  errors: ['WORKFLOW_BUILDER_SETTINGS_GET_FAILED'],
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
      return handleError(error, {
        message: 'Error getting workflow builder settings',
        code: SERVER_ERROR_CODES.WORKFLOW_BUILDER_SETTINGS_GET_FAILED,
      });
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
  errors: [
    'REQUEST_ARGUMENT_REQUIRED',
    'RESOURCE_ID_REQUIRED',
    'THREAD_ACCESS_DENIED',
    'WORKFLOW_BUILDER_NOT_ENABLED',
    'WORKFLOW_BUILDER_STREAM_FAILED',
  ],
  handler: async ({ mastra, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor?.hasEnabledWorkflowBuilderConfig?.() || typeof editor.resolveWorkflowBuilder !== 'function') {
        throw new HTTPException(404, {
          message: 'Workflow builder is not enabled',
          code: SERVER_ERROR_CODES.WORKFLOW_BUILDER_NOT_ENABLED,
        });
      }

      const builder = await editor.resolveWorkflowBuilder();
      if (!builder?.enabled)
        throw new HTTPException(404, {
          message: 'Workflow builder is not enabled',
          code: SERVER_ERROR_CODES.WORKFLOW_BUILDER_NOT_ENABLED,
        });
      const agent = builder.getAgent();

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, scopes: _scopes, ...rest } = params;
      validateBody({ messages });

      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;
        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        requireEffectiveResourceId(effectiveResourceId);
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
          thread: applyEffectiveThreadId(memoryOption.thread, effectiveThreadId),
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
      return handleError(error, {
        message: 'Error streaming workflow builder response',
        code: SERVER_ERROR_CODES.WORKFLOW_BUILDER_STREAM_FAILED,
      });
    }
  },
});
