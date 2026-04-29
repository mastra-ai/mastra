import { openai } from '@ai-sdk/openai';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors';
import type { MastraStorage } from '@mastra/core/storage';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import {
  LIST_AGENTS_ROUTE,
  GET_AGENT_BY_ID_ROUTE,
  GENERATE_AGENT_ROUTE,
  getSerializedAgentTools,
  UPDATE_AGENT_MODEL_ROUTE,
  RESET_AGENT_MODEL_ROUTE,
  REORDER_AGENT_MODEL_LIST_ROUTE,
  UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE,
  STREAM_GENERATE_LEGACY_ROUTE,
  STREAM_GENERATE_ROUTE,
  ENHANCE_INSTRUCTIONS_ROUTE,
} from './agents';
import { createTestServerContext } from './test-utils';
class MockAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);

    this.generate = vi.fn();
    this.stream = vi.fn();
    this.__updateInstructions = vi.fn();
  }

  generate(args: any) {
    return this.generate(args);
  }

  stream(args: any) {
    return this.stream(args);
  }

  __updateInstructions(args: any) {
    return this.__updateInstructions(args);
  }
}

const makeMockAgent = (config?: Partial<AgentConfig>) =>
  new MockAgent({
    name: 'test-agent',
    description: 'A test agent for unit testing',
    instructions: 'test instructions',
    model: openai('gpt-4o'),
    ...(config || {}),
  });

const makeMastraMock = ({ agents }: { agents: Record<string, ReturnType<typeof makeMockAgent>> }) =>
  new Mastra({
    logger: false,
    agents,
    storage: {
      init: vi.fn(),
      __setLogger: vi.fn(),
      getEvalsByAgentName: vi.fn(),
      getStorage: () => {
        return {
          getEvalsByAgentName: vi.fn(),
        };
      },
    } as unknown as MastraStorage,
  });

describe('Agent Handlers', () => {
  let mockMastra: Mastra;
  let mockAgent: Agent;
  let mockMultiModelAgent: Agent;
  const requestContext = new RequestContext();

  beforeEach(() => {
    mockAgent = makeMockAgent();

    mockMultiModelAgent = makeMockAgent({
      name: 'test-multi-model-agent',
      description: 'A test agent with multiple model configurations',
      model: [{ model: openaiV5('gpt-4o-mini') }, { model: openaiV5('gpt-4o') }, { model: openaiV5('gpt-4.1') }],
    });

    mockMastra = makeMastraMock({
      agents: {
        'test-agent': mockAgent,
        'test-multi-model-agent': mockMultiModelAgent,
      },
    });
  });

  describe('listAgentsHandler', () => {
    it('should return serialized agents', async () => {
      const result = await LIST_AGENTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        requestContext,
      });

      expect(result).toEqual({
        'test-agent': {
          id: 'test-agent',
          name: 'test-agent',
          description: 'A test agent for unit testing',
          instructions: 'test instructions',
          tools: {},
          agents: {},
          workflows: {},
          skills: [],
          workspaceTools: [],
          browserTools: [],
          workspaceId: undefined,
          inputProcessors: [],
          outputProcessors: [],
          provider: 'openai.chat',
          requestContextSchema: undefined,
          hasDraft: false,
          modelId: 'gpt-4o',
          modelVersion: 'v1',
          defaultOptions: {},
          defaultGenerateOptionsLegacy: {},
          defaultStreamOptionsLegacy: {},
          modelList: undefined,
          source: 'code',
        },
        'test-multi-model-agent': {
          id: 'test-multi-model-agent',
          name: 'test-multi-model-agent',
          description: 'A test agent with multiple model configurations',
          instructions: 'test instructions',
          tools: {},
          agents: {},
          workflows: {},
          hasDraft: false,
          requestContextSchema: undefined,
          skills: [],
          workspaceTools: [],
          browserTools: [],
          inputProcessors: [],
          outputProcessors: [],
          provider: 'openai.responses',
          modelId: 'gpt-4o-mini',
          modelVersion: 'v2',
          defaultOptions: {},
          defaultGenerateOptionsLegacy: {},
          defaultStreamOptionsLegacy: {},
          workspaceId: undefined,
          modelList: [
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              headers: undefined,
              model: { modelId: 'gpt-4o-mini', provider: 'openai.responses', modelVersion: 'v2' },
            },
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              headers: undefined,
              model: { modelId: 'gpt-4o', provider: 'openai.responses', modelVersion: 'v2' },
            },
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              headers: undefined,
              model: { modelId: 'gpt-4.1', provider: 'openai.responses', modelVersion: 'v2' },
            },
          ],
          source: 'code',
        },
      });
    });

    it('should return agents with serialized processors', async () => {
      const unicodeNormalizer = new UnicodeNormalizer();
      const tokenLimiter = new TokenLimiterProcessor({ limit: 1000 });

      const agentWithCoreProcessors = makeMockAgent({
        name: 'agent-with-core-processors',
        description: 'A test agent with input and output processors',
        inputProcessors: [unicodeNormalizer],
        outputProcessors: [tokenLimiter],
      });

      const mastraWithCoreProcessors = makeMastraMock({
        agents: {
          'agent-with-core-processors': agentWithCoreProcessors,
        },
      });

      const result = await LIST_AGENTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithCoreProcessors }),
        requestContext,
      });

      expect(result['agent-with-core-processors']).toMatchObject({
        name: 'agent-with-core-processors',
        description: 'A test agent with input and output processors',
        inputProcessors: [
          {
            id: 'agent-with-core-processors-input-processor',
            name: 'agent-with-core-processors-input-processor',
          },
        ],
        outputProcessors: [
          {
            id: 'agent-with-core-processors-output-processor',
            name: 'agent-with-core-processors-output-processor',
          },
        ],
      });
    });

    it('should return serialized agents with partial data when partial=true query param is provided', async () => {
      const firstStep = createStep({
        id: 'first',
        description: 'First step',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({ name: z.string() }),
        execute: async ({ inputData }) => ({
          name: inputData.name,
        }),
      });

      const workflow = createWorkflow({
        id: 'hello-world',
        description: 'A simple hello world workflow',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          greeting: z.string(),
        }),
      });

      workflow.then(firstStep);

      const agentWithSchemas = makeMockAgent({
        name: 'agent-with-schemas',
        workflows: { hello: workflow },
        tools: {
          testTool: {
            id: 'test-tool',
            description: 'A test tool',
            inputSchema: z.object({ input: z.string() }),
            outputSchema: z.object({ output: z.string() }),
          },
        },
      });

      const mastraWithSchemas = makeMastraMock({
        agents: { 'agent-with-schemas': agentWithSchemas },
      });

      const result = await LIST_AGENTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithSchemas }),
        requestContext,
        partial: 'true',
      });

      // When partial=true, inputSchema, outputSchema, resumeSchema, suspendSchema should be pruned
      const agent = result['agent-with-schemas'];
      expect(agent).toBeDefined();
      expect(agent.name).toBe('agent-with-schemas');
      expect(agent.description).toBe('A test agent for unit testing');

      // Verify tools have no schemas when partial=true
      expect(agent.tools.testTool).toBeDefined();
      expect(agent.tools.testTool.id).toBe('test-tool');
      expect(agent.tools.testTool.description).toBe('A test tool');
      expect(agent.tools.testTool.inputSchema).toBeUndefined();
      expect(agent.tools.testTool.outputSchema).toBeUndefined();

      // Verify workflows return stepCount instead of full steps when partial=true
      expect(agent.workflows.hello).toBeDefined();
      expect(agent.workflows.hello.name).toBe('hello-world');
      expect(agent.workflows.hello.steps).toBeUndefined();
    });

    it('should return serialized agents with full schemas when partial param is not provided', async () => {
      const firstStep = createStep({
        id: 'first',
        description: 'First step',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({ name: z.string() }),
        execute: async ({ inputData }) => ({
          name: inputData.name,
        }),
      });

      const workflow = createWorkflow({
        id: 'hello-world',
        description: 'A simple hello world workflow',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          greeting: z.string(),
        }),
      });

      workflow.then(firstStep);

      const agentWithSchemas = makeMockAgent({
        name: 'agent-with-schemas',
        workflows: { hello: workflow },
        tools: {
          testTool: {
            id: 'test-tool',
            description: 'A test tool',
            inputSchema: z.object({ input: z.string() }),
            outputSchema: z.object({ output: z.string() }),
          },
        },
      });

      const mastraWithSchemas = makeMastraMock({
        agents: { 'agent-with-schemas': agentWithSchemas },
      });

      const result = await LIST_AGENTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithSchemas }),
        requestContext,
        // No partial parameter provided
      });

      // When partial is not provided, schemas should be included
      const agent = result['agent-with-schemas'];
      expect(agent).toBeDefined();

      // Verify tools have schemas when partial is not provided
      expect(agent.tools.testTool.inputSchema).toBeDefined();
      expect(agent.tools.testTool.outputSchema).toBeDefined();
      expect(typeof agent.tools.testTool.inputSchema).toBe('string');
      expect(typeof agent.tools.testTool.outputSchema).toBe('string');
    });

    it('should serialize plain JSON Schema tool schemas', async () => {
      const inputSchema = {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      };

      const outputSchema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      };

      const requestContextSchema = {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      };

      const tools = await getSerializedAgentTools({
        composioTool: {
          id: 'composio-tool',
          inputSchema,
          outputSchema,
          requestContextSchema,
        },
      });

      expect(tools.composioTool.inputSchema).toBeDefined();
      expect(tools.composioTool.outputSchema).toBeDefined();
      expect(tools.composioTool.requestContextSchema).toBeDefined();
      expect(tools.composioTool.inputSchema).toContain('"query"');
      expect(tools.composioTool.outputSchema).toContain('"result"');
      expect(tools.composioTool.requestContextSchema).toContain('"userId"');
      expect(tools.composioTool.inputSchema).toContain('https://json-schema.org/draft/2020-12/schema');
      expect(tools.composioTool.outputSchema).toContain('https://json-schema.org/draft/2020-12/schema');
      expect(tools.composioTool.requestContextSchema).toContain('https://json-schema.org/draft/2020-12/schema');
    });

    it('should not expose a model list for agents with dynamic single-model selection', async () => {
      const dynamicSingleModelAgent = makeMockAgent({
        name: 'dynamic-single-model-agent',
        description: 'A test agent with dynamic single-model selection',
        model: ({ requestContext }) => {
          return requestContext.get('foo') ? openaiV5('gpt-4o-mini') : openaiV5('gpt-4.1');
        },
      });

      const mastraWithDynamicSingleModel = makeMastraMock({
        agents: { 'dynamic-single-model-agent': dynamicSingleModelAgent },
      });

      const dynamicRequestContext = new RequestContext();
      dynamicRequestContext.set('foo', true);

      const result = await LIST_AGENTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithDynamicSingleModel }),
        requestContext: dynamicRequestContext,
      });

      expect(result['dynamic-single-model-agent']).toMatchObject({
        name: 'dynamic-single-model-agent',
        description: 'A test agent with dynamic single-model selection',
        provider: 'openai.responses',
        modelId: 'gpt-4o-mini',
        modelVersion: 'v2',
        modelList: undefined,
      });
    });
  });

  describe('getAgentByIdHandler', () => {
    it('should return serialized agent', async () => {
      const firstStep = createStep({
        id: 'first',
        description: 'First step',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({ name: z.string() }),
        execute: async ({ inputData }) => ({
          name: inputData.name,
        }),
      });

      const secondStep = createStep({
        id: 'second',
        description: 'Second step',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async () => ({ greeting: 'Hello, world!' }),
      });

      const workflow = createWorkflow({
        id: 'hello-world',
        description: 'A simple hello world workflow with two steps',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          greeting: z.string(),
        }),
      });

      workflow.then(firstStep).then(secondStep);
      mockAgent = makeMockAgent({ workflows: { hello: workflow } });
      mockMastra = makeMastraMock({ agents: { 'test-agent': mockAgent } });
      const result = await GET_AGENT_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
      });

      expect(result).toEqual({
        name: 'test-agent',
        description: 'A test agent for unit testing',
        instructions: 'test instructions',
        tools: {},
        agents: {},
        workflows: {
          hello: {
            name: 'hello-world',
            steps: {
              first: {
                id: 'first',
                description: 'First step',
              },
              second: {
                id: 'second',
                description: 'Second step',
              },
            },
          },
        },
        skills: [],
        workspaceTools: [],
        browserTools: [],
        workspaceId: undefined,
        inputProcessors: [],
        outputProcessors: [],
        provider: 'openai.chat',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        defaultOptions: {},
        defaultGenerateOptionsLegacy: {},
        defaultStreamOptionsLegacy: {},
        modelList: undefined,
        requestContextSchema: undefined,
        source: 'code',
      });
    });

    it('should return serialized agent with model list', async () => {
      const result = await GET_AGENT_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-multi-model-agent',
        requestContext,
      });
      if (!result) {
        expect.fail('Result should be defined');
      }
      expect(result.modelList).toMatchObject([
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4o-mini', provider: 'openai.responses', modelVersion: 'v2' },
        },
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4o', provider: 'openai.responses', modelVersion: 'v2' },
        },
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4.1', provider: 'openai.responses', modelVersion: 'v2' },
        },
      ]);
    });

    it('should return serialized agent without a model list for dynamic single-model selection', async () => {
      const dynamicSingleModelAgent = makeMockAgent({
        name: 'dynamic-single-model-agent',
        description: 'A test agent with dynamic single-model selection',
        model: ({ requestContext }) => {
          return requestContext.get('foo') ? openaiV5('gpt-4o-mini') : openaiV5('gpt-4.1');
        },
      });

      const mastraWithDynamicSingleModel = makeMastraMock({
        agents: { 'dynamic-single-model-agent': dynamicSingleModelAgent },
      });

      const dynamicRequestContext = new RequestContext();
      dynamicRequestContext.set('foo', true);

      const result = await GET_AGENT_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithDynamicSingleModel }),
        agentId: 'dynamic-single-model-agent',
        requestContext: dynamicRequestContext,
      });

      expect(result).toMatchObject({
        name: 'dynamic-single-model-agent',
        description: 'A test agent with dynamic single-model selection',
        provider: 'openai.responses',
        modelId: 'gpt-4o-mini',
        modelVersion: 'v2',
        modelList: undefined,
      });
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        GET_AGENT_BY_ID_ROUTE.handler({ ...createTestServerContext({ mastra: mockMastra }), agentId: 'non-existing' }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Agent with id non-existing not found',
        }),
      );
    });

    it('should return serialized agent with browser tools when browser is configured', async () => {
      const mockBrowser = {
        providerType: 'sdk' as const,
        getTools: () => ({
          navigate: { name: 'navigate' },
          click: { name: 'click' },
          screenshot: { name: 'screenshot' },
        }),
      };

      const agentWithBrowser = makeMockAgent({
        name: 'browser-agent',
        browser: mockBrowser as any,
      });

      const mastraWithBrowser = makeMastraMock({
        agents: { 'browser-agent': agentWithBrowser },
      });

      const result = await GET_AGENT_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithBrowser }),
        agentId: 'browser-agent',
        requestContext,
      });

      expect(result?.browserTools).toEqual(['navigate', 'click', 'screenshot']);
    });
  });

  describe('generateHandler', () => {
    it('should generate response from agent', async () => {
      const mockResult = { response: 'test' };
      (mockAgent.generate as any).mockResolvedValue(mockResult);

      const result = await GENERATE_AGENT_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        messages: ['test message'],
        resourceId: 'test-resource',
        threadId: 'test-thread',
        experimental_output: undefined,
      });

      expect(result).toEqual(mockResult);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        GENERATE_AGENT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'non-existing',
          messages: ['test message'],
          resourceId: 'test-resource',
          threadId: 'test-thread',
          experimental_output: undefined,
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Agent with id non-existing not found' }));
    });
  });

  describe('streamGenerateHandler', () => {
    it('should stream response from agent', async () => {
      const mockStreamResult = {
        toTextStreamResponse: vi.fn().mockReturnValue(new Response()),
        toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
      };
      (mockAgent.stream as any).mockResolvedValue(mockStreamResult);

      const result = await STREAM_GENERATE_LEGACY_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        messages: ['test message'],
        resourceId: 'test-resource',
        threadId: 'test-thread',
        experimental_output: undefined,
      });

      expect(result).toBeInstanceOf(Response);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        STREAM_GENERATE_LEGACY_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'non-existing',
          messages: ['test message'],
          resourceId: 'test-resource',
          threadId: 'test-thread',
          experimental_output: undefined,
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Agent with id non-existing not found' }));
    });
  });

  describe('updateAgentModelHandler', () => {
    it('should update agent model', async () => {
      const mockFullStream = new ReadableStream();
      const mockStreamResult = {
        toTextStreamResponse: vi.fn().mockReturnValue(new Response()),
        toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
        fullStream: mockFullStream,
      };
      (mockAgent.stream as any).mockResolvedValue(mockStreamResult);
      const updateResult = await UPDATE_AGENT_MODEL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        modelId: 'gpt-4o-mini',
        provider: 'openai',
      });

      const agent = mockMastra.getAgentById('test-agent');
      const llm = await agent.getLLM();
      const modelId = llm.getModelId();
      expect(updateResult).toEqual({ message: 'Agent model updated' });
      expect(modelId).toEqual('gpt-4o-mini');
      //confirm that stream works fine after the model update

      const result = await STREAM_GENERATE_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        messages: ['test message'],
        resourceId: 'test-resource',
        threadId: 'test-thread',
        experimental_output: undefined,
      });

      expect(result).toBeDefined();
    });
  });

  describe('reorderAgentModelListHandler', () => {
    it('should reorder list of models for agent', async () => {
      const agent = mockMastra.getAgentById('test-multi-model-agent');
      const modelList = await agent.getModelList();

      if (!modelList) {
        expect.fail('Model list should be defined');
      }

      const modelListIds = modelList.map(m => m.id);
      const reversedModelListIds = modelListIds.reverse();

      await REORDER_AGENT_MODEL_LIST_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-multi-model-agent',
        reorderedModelIds: reversedModelListIds,
      });

      const reorderedModelList = await agent.getModelList();
      expect(reorderedModelList?.length).toBe(3);
      expect(reorderedModelList?.[0].model.modelId).toBe('gpt-4.1');
      expect(reorderedModelList?.[1].model.modelId).toBe('gpt-4o');
      expect(reorderedModelList?.[2].model.modelId).toBe('gpt-4o-mini');
    });
  });

  describe('updateAgentModelInModelListHandler', () => {
    it('should update a model in the model list', async () => {
      const agent = mockMastra.getAgentById('test-multi-model-agent');
      const modelList = await agent.getModelList();
      expect(modelList?.length).toBe(3);
      const model1Id = modelList?.[1].id!;
      await UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-multi-model-agent',
        modelConfigId: model1Id,
        model: {
          modelId: 'gpt-5',
          provider: 'openai',
        },
        maxRetries: 4,
      });
      const updatedModelList = await agent.getModelList();
      expect(updatedModelList?.[0].model.modelId).toBe('gpt-4o-mini');
      expect(updatedModelList?.[1].model.modelId).toBe('gpt-5');
      expect(updatedModelList?.[1].maxRetries).toBe(4);
      expect(updatedModelList?.[2].model.modelId).toBe('gpt-4.1');
    });
  });

  describe('Phase 8a: model-route allowlist enforcement', () => {
    function makeBuilderEditor(opts: {
      allowed?: Array<{ provider: string; modelId?: string; kind?: 'known' | 'custom' }>;
    }) {
      const allowed = opts.allowed?.map(a => ({
        kind: a.kind ?? ('known' as const),
        provider: a.provider,
        ...(a.modelId !== undefined ? { modelId: a.modelId } : {}),
      }));
      return {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: async () => ({
          enabled: true,
          getFeatures: () => ({ agent: { model: true } }),
          getConfiguration: () => ({ agent: { models: { allowed } } }),
        }),
      };
    }

    function attachEditorToMastra(mastra: Mastra, editor: ReturnType<typeof makeBuilderEditor> | undefined) {
      (mastra as unknown as { getEditor: () => unknown }).getEditor = () => editor;
    }

    describe('UPDATE_AGENT_MODEL_ROUTE', () => {
      it('rejects with 422 + MODEL_NOT_ALLOWED when target model is outside the allowlist', async () => {
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ provider: 'openai' }] }));

        let caught: HTTPException | undefined;
        try {
          await UPDATE_AGENT_MODEL_ROUTE.handler({
            ...createTestServerContext({ mastra: mockMastra }),
            agentId: 'test-agent',
            modelId: 'claude-opus-4-7',
            provider: 'anthropic',
          });
        } catch (e) {
          caught = e as HTTPException;
        }

        expect(caught).toBeInstanceOf(HTTPException);
        expect(caught?.status).toBe(422);
        const body = await caught!.getResponse().json();
        expect(body.error.code).toBe('MODEL_NOT_ALLOWED');
        expect(body.error.attempted).toMatchObject({ provider: 'anthropic', modelId: 'claude-opus-4-7' });
      });

      it('accepts an allowed wildcard provider entry', async () => {
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ provider: 'openai' }] }));

        const result = await UPDATE_AGENT_MODEL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'test-agent',
          modelId: 'gpt-4o-mini',
          provider: 'openai',
        });
        expect(result).toEqual({ message: 'Agent model updated' });
      });

      it('passes through when no editor is configured', async () => {
        attachEditorToMastra(mockMastra, undefined);

        const result = await UPDATE_AGENT_MODEL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'test-agent',
          modelId: 'claude-opus-4-7',
          provider: 'anthropic',
        });
        expect(result).toEqual({ message: 'Agent model updated' });
      });
    });

    describe('RESET_AGENT_MODEL_ROUTE', () => {
      it('rejects when the original model is no longer in the allowlist', async () => {
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ provider: 'anthropic' }] }));

        let caught: HTTPException | undefined;
        try {
          await RESET_AGENT_MODEL_ROUTE.handler({
            ...createTestServerContext({ mastra: mockMastra }),
            agentId: 'test-agent',
          });
        } catch (e) {
          caught = e as HTTPException;
        }

        expect(caught).toBeInstanceOf(HTTPException);
        expect(caught?.status).toBe(422);
        const body = await caught!.getResponse().json();
        expect(body.error.code).toBe('MODEL_NOT_ALLOWED');
      });

      it('accepts reset when original model is in the allowlist', async () => {
        // The mock agent's resolved provider is "openai.chat" (AI SDK provider id), not the
        // registered "openai" entry, so we have to declare it as a custom provider.
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ kind: 'custom', provider: 'openai.chat' }] }));

        const result = await RESET_AGENT_MODEL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'test-agent',
        });
        expect(result).toEqual({ message: 'Agent model reset to original' });
      });
    });

    describe('UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE', () => {
      it('rejects 422 when the new entry is outside the allowlist', async () => {
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ provider: 'openai' }] }));

        const agent = mockMastra.getAgentById('test-multi-model-agent');
        const modelList = await agent.getModelList();
        const targetId = modelList![0].id;

        let caught: HTTPException | undefined;
        try {
          await UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE.handler({
            ...createTestServerContext({ mastra: mockMastra }),
            agentId: 'test-multi-model-agent',
            modelConfigId: targetId,
            model: { provider: 'anthropic', modelId: 'claude-opus-4-7' },
          });
        } catch (e) {
          caught = e as HTTPException;
        }

        expect(caught).toBeInstanceOf(HTTPException);
        expect(caught?.status).toBe(422);
        const body = await caught!.getResponse().json();
        expect(body.error.code).toBe('MODEL_NOT_ALLOWED');
      });

      it('skips enforcement when body does not change provider/modelId', async () => {
        attachEditorToMastra(mockMastra, makeBuilderEditor({ allowed: [{ provider: 'anthropic' }] }));

        const agent = mockMastra.getAgentById('test-multi-model-agent');
        const modelList = await agent.getModelList();
        const targetId = modelList![0].id;

        const result = await UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'test-multi-model-agent',
          modelConfigId: targetId,
          maxRetries: 5,
        });
        expect(result).toMatchObject({ message: 'Model updated in model list' });
      });
    });
  });

  describe('enhanceInstructionsHandler', () => {
    it('should enhance instructions and return structured output', async () => {
      // Set OPENAI_API_KEY so isProviderConnected returns true
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const mockEnhancedResult = {
        object: {
          explanation: 'Added more specific guidelines for tone and response format.',
          new_prompt:
            'You are a helpful assistant. Always respond in a friendly, professional tone. Keep responses concise.',
        },
      };

      // Spy on Agent.prototype.generate since the handler creates a new Agent instance
      const generateSpy = vi.spyOn(Agent.prototype, 'generate').mockResolvedValue(mockEnhancedResult as any);

      try {
        const result = await ENHANCE_INSTRUCTIONS_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          agentId: 'test-agent',
          instructions: 'You are a helpful assistant.',
          comment: 'Make it more specific about tone',
        });

        expect(result).toEqual({
          explanation: 'Added more specific guidelines for tone and response format.',
          new_prompt:
            'You are a helpful assistant. Always respond in a friendly, professional tone. Keep responses concise.',
        });

        expect(generateSpy).toHaveBeenCalledOnce();
      } finally {
        generateSpy.mockRestore();
        // Restore original env var
        if (originalEnv === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = originalEnv;
        }
      }
    });

    it('rejects with 400 when the only connected model is outside the admin allowlist', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      // Allow only anthropic — agent's openai model must be filtered out by the
      // policy-aware findConnectedModel, even though OPENAI_API_KEY is set.
      const editor = {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: async () => ({
          enabled: true,
          getFeatures: () => ({ agent: { model: true } }),
          getConfiguration: () => ({
            agent: { models: { allowed: [{ kind: 'known' as const, provider: 'anthropic' }] } },
          }),
        }),
      };
      (mockMastra as unknown as { getEditor: () => unknown }).getEditor = () => editor;

      const generateSpy = vi.spyOn(Agent.prototype, 'generate');

      try {
        let caught: HTTPException | undefined;
        try {
          await ENHANCE_INSTRUCTIONS_ROUTE.handler({
            ...createTestServerContext({ mastra: mockMastra }),
            agentId: 'test-agent',
            instructions: 'You are a helpful assistant.',
            comment: 'Make it more specific',
          });
        } catch (e) {
          caught = e as HTTPException;
        }

        expect(caught).toBeInstanceOf(HTTPException);
        expect(caught?.status).toBe(400);
        expect(generateSpy).not.toHaveBeenCalled();
      } finally {
        generateSpy.mockRestore();
        if (originalEnv === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = originalEnv;
        }
      }
    });
  });
});
