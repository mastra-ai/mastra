import type {FastifyPluginAsyncZod} from 'fastify-type-provider-zod';
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod';
import {agents as agentsHandler, workflows as workflowsHandler} from '@mastra/server/handlers';
import {z} from 'zod';

// a subset from https://github.com/mastra-ai/mastra/tree/main/packages/deployer/src/server/handlers/routes

const mastraApi: FastifyPluginAsyncZod = async fastify => {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.get('/api/agents', () =>
    agentsHandler.listAgentsHandler({mastra: fastify.mastra, requestContext: fastify.requestContext}),
  );
  fastify.get(
    '/api/agents/:agentId',
    {
      schema: {
        params: z.object({
          agentId: z.string(),
        }),
      },
    },
    req =>
      agentsHandler.getAgentByIdHandler({
        mastra: fastify.mastra,
        requestContext: fastify.requestContext,
        agentId: req.params.agentId,
      }),
  );
  fastify.post(
    '/api/agents/:agentId/generate',
    {
      schema: {
        params: z.object({
          agentId: z.string(),
        }),
        body: z.any(),
      },
    },
    req =>
      agentsHandler.generateHandler({
        mastra: fastify.mastra,
        requestContext: fastify.requestContext,
        agentId: req.params.agentId,
        body: req.body as any,
      }),
  );
  fastify.get('/api/workflows', () => workflowsHandler.listWorkflowsHandler({mastra: fastify.mastra}));
  fastify.get(
    '/api/workflows/:workflowId',
    {
      schema: {
        params: z.object({
          workflowId: z.string(),
        }),
      },
    },
    req => workflowsHandler.getWorkflowByIdHandler({mastra: fastify.mastra, ...req.params}),
  );
  fastify.post(
    '/api/workflows/:workflowId/create-run',
    {
      schema: {
        params: z.object({
          workflowId: z.string(),
          runId: z.string().optional(),
        }),
      },
    },
    req =>
      workflowsHandler.createWorkflowRunHandler({
        mastra: fastify.mastra,
        workflowId: req.params.workflowId,
        runId: req.params.runId,
      }),
  );
  fastify.get(
    '/api/workflows/:workflowId/runs/:runId',
    {
      schema: {
        params: z.object({
          workflowId: z.string(),
          runId: z.string(),
        }),
      },
    },
    async req =>
      await workflowsHandler.getWorkflowRunByIdHandler({
        mastra: fastify.mastra,
        workflowId: req.params.workflowId,
        runId: req.params.runId,
      }),
  );
  fastify.post(
    '/api/workflows/:workflowId/start',
    {
      schema: {
        params: z.object({
          workflowId: z.string(),
        }),
        querystring: z.object({
          runId: z.string(),
        }),
        body: z.object({
          inputData: z.any(),
        }),
      },
    },
    async req =>
      await workflowsHandler.startWorkflowRunHandler({
        mastra: fastify.mastra,
        requestContext: fastify.requestContext,
        workflowId: req.params.workflowId,
        runId: req.query.runId,
        inputData: req.body.inputData,
      }),
  );
  fastify.post(
    '/api/workflows/:workflowId/start-async',
    {
      schema: {
        params: z.object({
          workflowId: z.string(),
        }),
        querystring: z.object({
          runId: z.string(),
        }),
        body: z.object({
          inputData: z.any(),
        }),
      },
    },
    async req =>
      await workflowsHandler.startAsyncWorkflowHandler({
        mastra: fastify.mastra,
        requestContext: fastify.requestContext,
        workflowId: req.params.workflowId,
        runId: req.query.runId,
        inputData: req.body.inputData,
      }),
  );
};

export default mastraApi;
