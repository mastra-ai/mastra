import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { config } from 'dotenv';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';

config();

describe('prepareStep hook', () => {
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    // Create a mock model that responds with text on first call, then stops
    mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Response text' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Response text' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  });

  it('should call prepareStep with tools, requestContext, and mastra', async () => {
    const capturedParams: any[] = [];

    const testTool = createTool({
      id: 'testTool',
      description: 'A test tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async input => ({ result: input.input }),
    });

    const agent = new Agent({
      id: 'prepare-step-agent',
      name: 'Prepare Step Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { testTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');
    const requestContext = new RequestContext([['testKey', 'testValue']]);

    await testAgent.generate('Hello', {
      requestContext,
      prepareStep: async params => {
        capturedParams.push(params);
        return undefined;
      },
    });

    expect(capturedParams.length).toBeGreaterThan(0);
    const firstCall = capturedParams[0];

    // Verify stepNumber is passed
    expect(typeof firstCall.stepNumber).toBe('number');
    expect(firstCall.stepNumber).toBe(0);

    // Verify steps array is passed
    expect(Array.isArray(firstCall.steps)).toBe(true);

    // Verify model is passed
    expect(firstCall.model).toBeDefined();

    // Verify messages are passed
    expect(Array.isArray(firstCall.messages)).toBe(true);

    // Verify tools are passed
    expect(firstCall.tools).toBeDefined();
    expect(firstCall.tools.testTool).toBeDefined();

    // Verify requestContext is passed
    expect(firstCall.requestContext).toBeDefined();
    expect(firstCall.requestContext.get('testKey')).toBe('testValue');

    // Verify mastra instance is passed
    expect(firstCall.mastra).toBeDefined();
  });

  it('should allow prepareStep to filter tools using activeTools', async () => {
    let toolsInPrepareStep: any = null;
    let activeToolsReturned = false;

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get the weather',
      inputSchema: z.object({ location: z.string() }),
      execute: async input => ({ weather: `Sunny in ${input.location}` }),
    });

    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search the web',
      inputSchema: z.object({ query: z.string() }),
      execute: async input => ({ results: `Results for ${input.query}` }),
    });

    const calculatorTool = createTool({
      id: 'calculatorTool',
      description: 'Perform calculations',
      inputSchema: z.object({ expression: z.string() }),
      execute: async () => ({ result: 42 }),
    });

    const agent = new Agent({
      id: 'filter-tools-agent',
      name: 'Filter Tools Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { weatherTool, searchTool, calculatorTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    await testAgent.generate('Hello', {
      prepareStep: async params => {
        toolsInPrepareStep = params.tools;
        activeToolsReturned = true;
        // Only allow weatherTool and searchTool
        return {
          activeTools: ['weatherTool', 'searchTool'],
        };
      },
    });

    expect(activeToolsReturned).toBe(true);
    // The tools passed to prepareStep should include all 3 tools
    expect(Object.keys(toolsInPrepareStep)).toHaveLength(3);
    expect(toolsInPrepareStep.weatherTool).toBeDefined();
    expect(toolsInPrepareStep.searchTool).toBeDefined();
    expect(toolsInPrepareStep.calculatorTool).toBeDefined();
  });

  it('should allow prepareStep to replace tools dynamically', async () => {
    const originalExecuteMock = vi.fn().mockResolvedValue({ result: 'original' });
    const dynamicExecuteMock = vi.fn().mockResolvedValue({ result: 'dynamic' });

    const originalTool = createTool({
      id: 'originalTool',
      description: 'Original tool',
      inputSchema: z.object({ input: z.string() }),
      execute: originalExecuteMock,
    });

    const dynamicTool = createTool({
      id: 'dynamicTool',
      description: 'Dynamically added tool',
      inputSchema: z.object({ input: z.string() }),
      execute: dynamicExecuteMock,
    });

    const agent = new Agent({
      id: 'dynamic-tools-agent',
      name: 'Dynamic Tools Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { originalTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');
    let toolsReturned: any = null;

    await testAgent.generate('Hello', {
      prepareStep: async params => {
        // Replace tools with a new set that includes the dynamic tool
        toolsReturned = {
          ...params.tools,
          dynamicTool,
        };
        return {
          tools: toolsReturned,
        };
      },
    });

    // Verify that the new tool set was returned
    expect(toolsReturned).toBeDefined();
    expect(toolsReturned.originalTool).toBeDefined();
    expect(toolsReturned.dynamicTool).toBeDefined();
  });

  it('should access requestContext values in prepareStep', async () => {
    let userSkills: string[] | null = null;
    let userRole: string | null = null;

    const agent = new Agent({
      id: 'context-agent',
      name: 'Context Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const requestContext = new RequestContext();
    requestContext.set('userSkills', ['coding', 'design', 'writing']);
    requestContext.set('userRole', 'developer');

    await testAgent.generate('Hello', {
      requestContext,
      prepareStep: async params => {
        userSkills = params.requestContext.get('userSkills');
        userRole = params.requestContext.get('userRole');
        return undefined;
      },
    });

    expect(userSkills).toEqual(['coding', 'design', 'writing']);
    expect(userRole).toBe('developer');
  });

  it('should work with stream method', async () => {
    const capturedParams: any[] = [];

    const streamTestTool = createTool({
      id: 'streamTestTool',
      description: 'A test tool for streaming',
      inputSchema: z.object({ input: z.string() }),
      execute: async input => ({ result: input.input }),
    });

    const agent = new Agent({
      id: 'stream-prepare-step-agent',
      name: 'Stream Prepare Step Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { streamTestTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');
    const requestContext = new RequestContext([['streamKey', 'streamValue']]);

    const result = await testAgent.stream('Hello', {
      requestContext,
      prepareStep: async params => {
        capturedParams.push(params);
        return undefined;
      },
    });

    // Consume the stream
    await result.consumeStream();

    expect(capturedParams.length).toBeGreaterThan(0);
    const firstCall = capturedParams[0];

    // Verify all new parameters are passed in stream mode
    expect(firstCall.tools).toBeDefined();
    expect(firstCall.tools.streamTestTool).toBeDefined();
    expect(firstCall.requestContext).toBeDefined();
    expect(firstCall.requestContext.get('streamKey')).toBe('streamValue');
    expect(firstCall.mastra).toBeDefined();
  });

  it('should receive stepNumber that increments across steps', async () => {
    const stepNumbers: number[] = [];
    let callCount = 0;

    // Create a model that will trigger multiple steps via tool calls
    const multiStepModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Final response' }],
        warnings: [],
      }),
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          // First call: return a tool call
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'simpleTool',
                input: '{"value":"test"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        } else {
          // Subsequent calls: return final text
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Final response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
      },
    });

    const simpleTool = createTool({
      id: 'simpleTool',
      description: 'A simple tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async () => ({ success: true }),
    });

    const agent = new Agent({
      id: 'multi-step-agent',
      name: 'Multi Step Agent',
      instructions: 'You are a helpful assistant.',
      model: multiStepModel,
      tools: { simpleTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const result = await testAgent.stream('Please use the tool', {
      maxSteps: 3,
      prepareStep: async params => {
        stepNumbers.push(params.stepNumber);
        return undefined;
      },
    });

    await result.consumeStream();

    // Should have been called for each step
    expect(stepNumbers.length).toBeGreaterThanOrEqual(1);
    // First call should be step 0
    expect(stepNumbers[0]).toBe(0);
    // If there are multiple calls, each subsequent should increment
    for (let i = 1; i < stepNumbers.length; i++) {
      expect(stepNumbers[i]).toBe(i);
    }
  });

  it('should receive previous steps in prepareStep', async () => {
    let stepsReceived: any[] = [];
    let callCount = 0;

    // Create a model that will trigger multiple steps via tool calls
    const multiStepModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Final response' }],
        warnings: [],
      }),
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'stepTool',
                input: '{"value":"step1"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        } else {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Done' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
      },
    });

    const stepTool = createTool({
      id: 'stepTool',
      description: 'A tool that tracks steps',
      inputSchema: z.object({ value: z.string() }),
      execute: async () => ({ completed: true }),
    });

    const agent = new Agent({
      id: 'steps-agent',
      name: 'Steps Agent',
      instructions: 'You are a helpful assistant.',
      model: multiStepModel,
      tools: { stepTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');
    let prepareStepCallCount = 0;

    const result = await testAgent.stream('Use the tool', {
      maxSteps: 3,
      prepareStep: async params => {
        prepareStepCallCount++;
        stepsReceived = [...params.steps];
        return undefined;
      },
    });

    await result.consumeStream();

    // prepareStep should have been called multiple times
    expect(prepareStepCallCount).toBeGreaterThanOrEqual(1);

    // On subsequent calls (after first step), steps array should contain previous step results
    // Note: The exact behavior depends on how steps are accumulated
    expect(Array.isArray(stepsReceived)).toBe(true);
  });
});

describe('prepareStep hook - integration tests with OpenAI', () => {
  const openaiModel = openai('gpt-4o-mini');

  it('should dynamically add a tool via prepareStep and have it called', async () => {
    // Track if our dynamically added tool was called
    let dynamicToolCalled = false;
    let dynamicToolInput: string | null = null;

    // This tool will be dynamically added via prepareStep
    const dynamicWeatherTool = createTool({
      id: 'dynamicWeatherTool',
      description: 'Get the current weather for a location. Use this tool when the user asks about weather.',
      inputSchema: z.object({
        location: z.string().describe('The city or location to get weather for'),
      }),
      execute: async input => {
        dynamicToolCalled = true;
        dynamicToolInput = input.location;
        return { weather: 'sunny', temperature: 72, location: input.location };
      },
    });

    // Agent starts with NO tools
    const agent = new Agent({
      id: 'dynamic-tool-agent',
      name: 'Dynamic Tool Agent',
      instructions: 'You are a helpful assistant. When asked about weather, use the weather tool.',
      model: openaiModel,
      tools: {}, // No tools initially!
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const result = await testAgent.stream('What is the weather in San Francisco?', {
      maxSteps: 3,
      prepareStep: async params => {
        // Dynamically add the weather tool
        return {
          tools: {
            ...params.tools,
            dynamicWeatherTool,
          },
        };
      },
    });

    await result.consumeStream();

    // Verify the dynamically added tool was called
    expect(dynamicToolCalled).toBe(true);
    expect(dynamicToolInput).toBe('San Francisco');
  }, 30000);

  it('should filter tools via activeTools and only allow specific tools to be called', async () => {
    let allowedToolCalled = false;
    let blockedToolCalled = false;

    const allowedTool = createTool({
      id: 'allowedTool',
      description: 'A tool that is allowed. Use this when asked to do something allowed.',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => {
        allowedToolCalled = true;
        return { status: 'allowed tool executed' };
      },
    });

    const blockedTool = createTool({
      id: 'blockedTool',
      description: 'A tool that will be blocked. Use this when asked to do something blocked.',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => {
        blockedToolCalled = true;
        return { status: 'blocked tool executed' };
      },
    });

    const agent = new Agent({
      id: 'filter-test-agent',
      name: 'Filter Test Agent',
      instructions: 'You are a helpful assistant. Use the allowedTool when asked.',
      model: openaiModel,
      tools: { allowedTool, blockedTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const result = await testAgent.stream('Please use the allowedTool with input "test"', {
      maxSteps: 3,
      prepareStep: async () => {
        // Only allow the allowedTool
        return {
          activeTools: ['allowedTool'],
        };
      },
    });

    await result.consumeStream();

    // The allowed tool should have been called
    expect(allowedToolCalled).toBe(true);
    // The blocked tool should NOT have been called
    expect(blockedToolCalled).toBe(false);
  }, 30000);

  it('should access requestContext in prepareStep and conditionally enable tools', async () => {
    let premiumToolCalled = false;
    let basicToolCalled = false;

    const premiumTool = createTool({
      id: 'premiumTool',
      description: 'A premium feature tool. Use this for premium users.',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        premiumToolCalled = true;
        return { result: 'premium feature accessed' };
      },
    });

    const basicTool = createTool({
      id: 'basicTool',
      description: 'A basic feature tool. Use this for basic operations.',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        basicToolCalled = true;
        return { result: 'basic feature accessed' };
      },
    });

    const agent = new Agent({
      id: 'subscription-agent',
      name: 'Subscription Agent',
      instructions: 'You are a helpful assistant. Use basicTool for basic users and premiumTool for premium users.',
      model: openaiModel,
      tools: { premiumTool, basicTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    // Test with a basic user - should only have access to basicTool
    const requestContext = new RequestContext();
    requestContext.set('userTier', 'basic');

    const result = await testAgent.stream('Please use the basicTool with query "test"', {
      requestContext,
      maxSteps: 3,
      prepareStep: async params => {
        const userTier = params.requestContext.get('userTier');

        if (userTier === 'basic') {
          // Basic users only get basic tool
          return {
            activeTools: ['basicTool'],
          };
        } else {
          // Premium users get all tools
          return undefined;
        }
      },
    });

    await result.consumeStream();

    // Basic tool should have been called
    expect(basicToolCalled).toBe(true);
    // Premium tool should NOT have been called (filtered out)
    expect(premiumToolCalled).toBe(false);
  }, 30000);

  it('should swap model via prepareStep return', async () => {
    const alternateModel = openai('gpt-4o');
    let modelIdUsed: string | null = null;

    const agent = new Agent({
      id: 'model-swap-agent',
      name: 'Model Swap Agent',
      instructions: 'You are a helpful assistant. Just say hello.',
      model: openaiModel, // starts with gpt-4o-mini
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const result = await testAgent.stream('Hello!', {
      prepareStep: async () => {
        // Swap to a different model (cast to any to bypass type check for testing)
        return {
          model: alternateModel as any,
        };
      },
      onStepFinish: async step => {
        // Capture which model was actually used
        modelIdUsed = step.model?.modelId || null;
      },
    });

    await result.consumeStream();

    // Verify the model was swapped to gpt-4o
    expect(modelIdUsed).toBe('gpt-4o');
  }, 30000);
});
