import { tool, ToolLoopAgent } from '@internal/ai-v6';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent/agent';
import {
  MockLanguageModelV3,
  convertArrayToReadableStreamV3,
} from '../../agent/__tests__/mock-model';
import { Mastra } from '../../mastra';
import { toolLoopAgentToMastraAgent, isToolLoopAgentLike, getSettings } from '../index';
import { ToolLoopAgentProcessor } from '../tool-loop-processor';

const MODEL = 'openai/gpt-4o-mini';

/**
 * Creates a mock model that captures the options passed to doGenerate/doStream
 * and returns a dummy response.
 */
function createCapturingMockModel(onCapture?: (options: any) => void) {
  return new MockLanguageModelV3({
    doGenerate: async options => {
      onCapture?.(options);
      return {
        finishReason: 'stop',
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        content: [{ type: 'text', text: 'Mock response' }],
        warnings: [],
      };
    },
    doStream: async options => {
      onCapture?.(options);
      return {
        stream: convertArrayToReadableStreamV3([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Mock response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ]),
      };
    },
  });
}

/**
 * Creates a mock model that simulates a tool call on first request,
 * then returns a text response on subsequent requests.
 */
function createToolCallingMockModel(toolName: string, toolInput: Record<string, unknown>) {
  let callCount = 0;
  const inputStr = JSON.stringify(toolInput);

  return new MockLanguageModelV3({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        // First call: return tool call
        return {
          finishReason: 'tool-calls' as const,
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName,
              input: inputStr,
            },
          ],
          warnings: [],
        };
      }
      // Subsequent calls: return text response
      return {
        finishReason: 'stop' as const,
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        content: [{ type: 'text' as const, text: 'The weather is 72°F and Sunny.' }],
        warnings: [],
      };
    },
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        // First call: return tool call
        return {
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName,
              input: inputStr,
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
            },
          ]),
        };
      }
      // Subsequent calls: return text response
      return {
        stream: convertArrayToReadableStreamV3([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: 'The weather is 72°F and Sunny.' },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ]),
      };
    },
  });
}

describe('ToolLoopAgent to Mastra Agent', () => {
  describe('isToolLoopAgentLike', () => {
    it('should return true for ToolLoopAgent instance', () => {
      const agent = new ToolLoopAgent({
        model: MODEL,
        instructions: 'You are helpful',
      });
      expect(isToolLoopAgentLike(agent)).toBe(true);
    });

    it('should return true for object with agent-v1 version', () => {
      const agentLike = { version: 'agent-v1' };
      expect(isToolLoopAgentLike(agentLike)).toBe(true);
    });

    it('should return false for regular objects', () => {
      expect(isToolLoopAgentLike({})).toBe(false);
      expect(isToolLoopAgentLike(null)).toBe(false);
      expect(isToolLoopAgentLike(undefined)).toBe(false);
    });

    it('should return false for mastra agent', () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: MODEL,
      });
      expect(isToolLoopAgentLike(agent)).toBe(false);
    });
  });

  describe('getSettings', () => {
    it('should extract settings from ToolLoopAgent', () => {
      const agent = new ToolLoopAgent({
        id: 'test-agent',
        model: MODEL,
        instructions: 'You are helpful',
        temperature: 0.7,
      });

      const settings = getSettings(agent);
      expect(settings.id).toBe('test-agent');
      expect(settings.instructions).toBe('You are helpful');
      expect(settings.temperature).toBe(0.7);
    });

    it('should throw for invalid agent', () => {
      expect(() => getSettings({} as any)).toThrow('Could not extract settings from ToolLoopAgent');
    });
  });

  describe('ToolLoopAgentProcessor.getAgentConfig', () => {
    it('should map basic settings to agent config', () => {
      const agent = new ToolLoopAgent({
        id: 'test-agent',
        model: MODEL,
        instructions: 'You are helpful',
      });

      const processor = new ToolLoopAgentProcessor(agent);
      const config = processor.getAgentConfig();

      expect(config.id).toBe('test-agent');
      expect(config.name).toBe('test-agent');
      expect(config.instructions).toBe('You are helpful');
      expect(config.model).toBe(MODEL);
    });

    it('should map model settings to defaultOptions.modelSettings', () => {
      const agent = new ToolLoopAgent({
        id: 'test-agent',
        model: MODEL,
        instructions: 'Test',
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1000,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
        stopSequences: ['END', 'STOP'],
        seed: 12345,
      });

      const processor = new ToolLoopAgentProcessor(agent);
      const config = processor.getAgentConfig();

      expect(config.defaultOptions?.modelSettings).toEqual({
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1000,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
        stopSequences: ['END', 'STOP'],
        seed: 12345,
      });
    });

    it('should map toolChoice to defaultOptions', () => {
      const agent = new ToolLoopAgent({
        id: 'test-agent',
        model: MODEL,
        instructions: 'Test',
        toolChoice: 'auto',
      });

      const processor = new ToolLoopAgentProcessor(agent);
      const config = processor.getAgentConfig();

      expect(config.defaultOptions?.toolChoice).toBe('auto');
    });

    it('should map tools', () => {
      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const agent = new ToolLoopAgent({
        id: 'test-agent',
        model: MODEL,
        instructions: 'Test',
        tools: { weather: weatherTool },
      });

      const processor = new ToolLoopAgentProcessor(agent);
      const config = processor.getAgentConfig();

      expect(config.tools).toBeDefined();
      expect((config.tools as any)?.weather).toBeDefined();
    });

    it('should not include defaultOptions when no settings', () => {
      const agent = new ToolLoopAgent({
        model: MODEL,
        instructions: 'Test',
      });

      const processor = new ToolLoopAgentProcessor(agent);
      const config = processor.getAgentConfig();

      expect(config.defaultOptions).toBeUndefined();
    });
  });

  describe('toolLoopAgentToMastraAgent', () => {
    it('should return a Mastra Agent', () => {
      const toolLoopAgent = new ToolLoopAgent({
        id: 'weather-agent',
        model: MODEL,
        instructions: 'You are a weather assistant',
      });

      const mastraAgent = toolLoopAgentToMastraAgent(toolLoopAgent);

      expect(mastraAgent.id).toBe('weather-agent');
      expect(mastraAgent.name).toBe('weather-agent');
      expect(mastraAgent).toBeInstanceOf(Agent);
    });
  });

  describe('Mastra integration', () => {
    it('should register ToolLoopAgent via Mastra config', () => {
      const toolLoopAgent = new ToolLoopAgent({
        id: 'my-tool-loop-agent',
        model: MODEL,
        instructions: 'You are helpful',
      });

      const mastra = new Mastra({
        agents: {
          myAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('myAgent');
      expect(agent).toBeDefined();
      expect(agent.id).toBe('my-tool-loop-agent');
    });

    it('should use config key as fallback name', () => {
      const toolLoopAgent = new ToolLoopAgent({
        model: MODEL,
        instructions: 'You are helpful',
      });

      const mastra = new Mastra({
        agents: {
          weatherAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('weatherAgent');
      expect(agent).toBeDefined();
      expect(agent.id).toBe('weatherAgent');
    });

    it('should be callable via generate', async () => {
      const mockModel = createCapturingMockModel();

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a helpful assistant. Be concise.',
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await agent.generate('Say hello');

      expect(result).toBeDefined();
      expect(result.text).toBe('Mock response');
    });

    it('should be callable via stream', async () => {
      const mockModel = createCapturingMockModel();

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a helpful assistant. Be concise.',
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      const stream = await agent.stream('Say hello');

      const chunks: string[] = [];
      for await (const chunk of stream.textStream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('Mock response');
    });

    it('should work with tools', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'San Francisco' });

      const weatherTool = tool({
        description: 'Get the current weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The city name'),
        }),
        execute: async (input: { location: string }) => {
          return { location: input.location, temperature: 72, condition: 'Sunny' };
        },
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'weather-agent',
        model: mockModel,
        instructions: 'You are a weather assistant. Use the weather tool to get weather information.',
        tools: { weather: weatherTool },
      });

      const mastra = new Mastra({
        agents: {
          weatherAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('weatherAgent');
      const result = await agent.generate('What is the weather in San Francisco?');

      expect(result).toBeDefined();
      expect(result.text).toBe('The weather is 72°F and Sunny.');
      expect(result.toolCalls.length).toBeGreaterThan(0);
      expect(result.toolCalls[0].payload.toolName).toBe('weather');
      // The agent should have used the tool (2 steps: tool call + final response)
      expect(result.steps.length).toBe(2);
    });
  });

  describe('prepareCall hook', () => {
    it('should call prepareCall on first step', async () => {
      const mockModel = createCapturingMockModel();
      const prepareCallSpy = vi.fn().mockImplementation(input => input);

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are helpful',
        prepareCall: prepareCallSpy,
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('Hello');
      expect(prepareCallSpy).toHaveBeenCalledTimes(1);
    });

    it('should apply instructions override from prepareCall', async () => {
      let capturedOptions: any;
      const mockModel = createCapturingMockModel(options => {
        capturedOptions = options;
      });

      const prepareCallInstructions = 'You are very helpful and always say "I am helpful" in your response.';
      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are unhelpful',
        prepareCall: input => ({
          ...input,
          instructions: prepareCallInstructions,
        }),
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('What are you?');

      // Verify the system message contains the prepareCall instructions, not the original
      const systemMessage = capturedOptions.prompt.find((msg: any) => msg.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toEqual(prepareCallInstructions);
    });

    it('should apply temperature override from prepareCall', async () => {
      let capturedOptions: any;
      const mockModel = createCapturingMockModel(options => {
        capturedOptions = options;
      });

      const prepareCallSpy = vi.fn().mockImplementation(input => ({
        ...input,
        temperature: 0.1, // Very low temperature for deterministic output
      }));

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are helpful',
        temperature: 1.0, // High temperature in config
        prepareCall: prepareCallSpy,
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('Hello');

      expect(prepareCallSpy).toHaveBeenCalled();
      // Verify the temperature was overridden in the model call
      expect(capturedOptions.temperature).toBe(0.1);
    });
  });

  describe('prepareStep hook', () => {
    it('should call prepareStep on each step', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'NYC' });
      const prepareStepSpy = vi.fn().mockResolvedValue({});

      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a weather assistant. Always use the weather tool.',
        tools: { weather: weatherTool },
        prepareStep: prepareStepSpy,
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('What is the weather in NYC?');

      // prepareStep is called at least once (on each step)
      expect(prepareStepSpy).toHaveBeenCalled();
      // With tool call, should be called twice (step 0 for tool call, step 1 for final response)
      expect(prepareStepSpy).toHaveBeenCalledTimes(2);
    });

    it('should receive stepNumber in prepareStep', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'NYC' });
      const stepNumbers: number[] = [];

      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a weather assistant. Always use the weather tool.',
        tools: { weather: weatherTool },
        prepareStep: async ({ stepNumber }) => {
          stepNumbers.push(stepNumber);
          return {};
        },
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('What is the weather in NYC?');

      // First step should be 0
      expect(stepNumbers[0]).toBe(0);
      // With tool call, there should be a second step
      expect(stepNumbers[1]).toBe(1);
    });

    it('should apply toolChoice override from prepareStep', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'somewhere' });

      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a weather assistant.',
        tools: { weather: weatherTool },
        prepareStep: async ({ stepNumber }) => {
          // Force tool use on first step
          if (stepNumber === 0) {
            return { toolChoice: 'required' as const };
          }
          return {};
        },
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await agent.generate('Hello');

      // With toolChoice: 'required', the first step should have a tool call
      expect(result.steps.length).toBe(2);
    });
  });

  describe('stopWhen condition', () => {
    it('should stop when condition returns true', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'NYC' });
      let stopWhenCalled = false;

      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a weather assistant. Use the weather tool multiple times for different cities.',
        tools: { weather: weatherTool },
        stopWhen: async ({ steps }) => {
          stopWhenCalled = true;
          // Stop after first tool use (checked after step completes)
          return steps.some(step => step.toolCalls && step.toolCalls.length > 0);
        },
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('Get weather for NYC, LA, and Chicago');

      // stopWhen should have been called
      expect(stopWhenCalled).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should call onStepFinish after each step', async () => {
      const mockModel = createCapturingMockModel();
      const onStepFinishSpy = vi.fn();

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are helpful. Be concise.',
        onStepFinish: onStepFinishSpy,
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('Say hi');

      expect(onStepFinishSpy).toHaveBeenCalled();
    });

    it('should call onFinish when generation completes', async () => {
      const mockModel = createCapturingMockModel();
      const onFinishSpy = vi.fn();

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are helpful. Be concise.',
        onFinish: onFinishSpy,
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('Say hi');

      expect(onFinishSpy).toHaveBeenCalled();
    });

    it('should call onStepFinish for each step with tool calls', async () => {
      const mockModel = createToolCallingMockModel('weather', { location: 'NYC' });
      const stepFinishCalls: any[] = [];

      const weatherTool = tool({
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({ temp: 72 }),
      });

      const toolLoopAgent = new ToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'You are a weather assistant. Use the weather tool.',
        tools: { weather: weatherTool },
        onStepFinish: step => {
          stepFinishCalls.push(step);
        },
      });

      const mastra = new Mastra({
        agents: {
          testAgent: toolLoopAgent,
        },
      });

      const agent = mastra.getAgent('testAgent');
      await agent.generate('What is the weather in NYC?');

      // With tool call mock, should have 2 step finish calls (tool call step + final response step)
      expect(stepFinishCalls.length).toBe(2);
    });
  });
});
