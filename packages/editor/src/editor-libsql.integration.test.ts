import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { createScorer } from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';
import { MastraEditor } from './index';
import { randomUUID } from 'crypto';
import { convertArrayToReadableStream, LanguageModelV2, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  ProcessInputArgs,
  ProcessInputResult,
  Processor,
  ProcessorMessageResult,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import { ProcessorProvider } from '@mastra/core/processor-provider';
import { StoredProcessorGraph } from '@mastra/core/storage';
import { MastraMessageContentV2 } from '@mastra/core/agent/message-list';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { MastraModelGateway, ProviderConfig } from '@mastra/core/llm';

// Create in-memory LibSQL store for testing
const createTestStorage = () => {
  return new LibSQLStore({
    id: `test-${randomUUID()}`,
    url: ':memory:',
  });
};

// Create in-memory LibSQL vector for testing
const createTestVector = (id: string) => {
  return new LibSQLVector({
    id,
    url: ':memory:',
  });
};

// Mock LLM using MockLanguageModelV2
const createMockLLM = (responses: { text?: string; toolCall?: any }[] = []) => {
  let responseIndex = 0;

  return new MockLanguageModelV2({
    doGenerate: async (args: any) => {
      const response = responses[responseIndex] || { text: 'Default response' };

      if (responseIndex < responses.length - 1) {
        responseIndex++;
      }

      // Extract system prompt from the prompt array to include in the response
      const systemPrompt = args.prompt
        ?.filter((m: any) => m.role === 'system')
        .map((m: any) => m.content)
        .join('\n');

      const content: any[] = [];

      if (response.text) {
        content.push({
          type: 'text',
          text: systemPrompt ? `[system: ${systemPrompt}] ${response.text}` : response.text,
        });
      }

      if (response.toolCall) {
        content.push({
          type: 'tool-call',
          toolCallId: `call_${Date.now()}`,
          toolName: response.toolCall.name,
          args: response.toolCall.args,
        });
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content,
        warnings: [],
      };
    },
    doStream: async () => {
      const response = responses[responseIndex] || { text: 'Default response' };
      if (responseIndex < responses.length - 1) {
        responseIndex++;
      }

      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'id-0',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
      ];

      if (response.text) {
        chunks.push(
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: response.text },
          { type: 'text-end', id: 'text-1' },
        );
      }

      if (response.toolCall) {
        chunks.push(
          {
            type: 'tool-call-start',
            id: 'tool-1',
            toolCallId: `call_${Date.now()}`,
            toolName: response.toolCall.name,
          },
          {
            type: 'tool-call-delta',
            id: 'tool-1',
            argsTextDelta: JSON.stringify(response.toolCall.args),
          },
          { type: 'tool-call-end', id: 'tool-1' },
        );
      }

      chunks.push({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks),
      };
    },
  });
};

class MockGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Mock Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: {
        name: 'Mock Provider',
        models: ['mock-model'],
        apiKeyEnvVar: 'MOCK_API_KEY',
        gateway: 'models.dev',
      },
    };
  }
  buildUrl(_modelId: string): string {
    return 'https://api.mock-gateway.com/v1';
  }
  getApiKey(modelId: string): Promise<string> {
    console.log('MockGateway.getApiKey called with modelId:', modelId);
    return Promise.resolve('MOCK_API_KEY');
  }

  async resolveEmbeddingModel({
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<any> {
    console.log('MockGateway.resolveEmbeddingModel called with:', { modelId, providerId });

    // Mock embedding model that returns fixed-size vectors
    return {
      specificationVersion: 'v2',
      modelId: modelId,
      provider: providerId,
      maxEmbeddingsPerCall: 2048,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: any[] }) => {
        console.log('Mock embedder called with', values.length, 'values');
        // Return mock embeddings with dimension 1536 (same as openai/text-embedding-3-small)
        return {
          embeddings: values.map(() => new Array(1536).fill(0).map(() => Math.random())),
        };
      },
    };
  }
  async resolveLanguageModel({
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<LanguageModelV2> {
    console.log('MockGateway.resolveLanguageModel called with:', { modelId, providerId });

    // Return different mock models based on modelId
    switch (modelId) {
      case 'mock/mock-model':
      case 'mock-model':
        // Default mock model
        return createMockLLM([
          { text: 'Mock response' },
          { text: 'Another mock response' },
          { text: 'Third mock response' },
        ]);

      case 'mock/weather-mock':
      case 'weather-mock':
        // Mock model for weather queries
        return createMockLLM([
          {
            text: 'Let me check the weather for you.',
            toolCall: {
              name: 'weather-tool',
              args: { city: 'Paris' },
            },
          },
          {
            text: 'Based on the weather data, Paris is sunny and 22°C.',
          },
        ]);

      case 'mock/structured-mock':
      case 'structured-mock':
        // Mock model that returns structured data for tests
        return createMockLLM([{ text: 'Here is the location data: San Francisco' }]);

      default:
        // Fallback mock model
        return new MockLanguageModelV2({
          doGenerate: async options => {
            return {
              content: [{ type: 'text', text: 'Default mock response' }],
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              warnings: [],
            };
          },

          supportedUrls: {},
          provider: 'mock',
          modelId: 'mock-model',
        });
    }
  }
}

// Test primitives
const weatherTool = createTool({
  id: 'weather-tool',
  description: 'Get weather information for a city',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.string(),
  execute: async ({ city }) => {
    return `The weather in ${city} is sunny and 22°C`;
  },
});

const userSearchTool = createTool({
  id: 'user-search',
  description: 'Search for a user by name',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    email: z.string(),
    found: z.boolean(),
  }),
  execute: async ({ name }) => ({
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    found: true,
  }),
});

const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  steps: [
    createStep({
      id: 'greet',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      execute: async ({ inputData }) => ({ greeting: `Hello, ${inputData.name}!` }),
    }),
  ],
});

const processOrderWorkflow = createWorkflow({
  id: 'process-order',
  inputSchema: z.object({ orderId: z.string() }),
  outputSchema: z.object({ success: z.boolean(), paymentId: z.string() }),
  steps: [
    createStep({
      id: 'validate-order',
      inputSchema: z.object({ orderId: z.string() }),
      outputSchema: z.object({ valid: z.boolean(), orderId: z.string() }),
      execute: async ({ inputData }) => ({ valid: true, orderId: inputData.orderId }),
    }),
    createStep({
      id: 'process-payment',
      inputSchema: z.object({ orderId: z.string() }),
      outputSchema: z.object({ success: z.boolean(), paymentId: z.string() }),
      execute: async ({ inputData }) => ({ success: true, paymentId: `pay_${inputData.orderId}` }),
    }),
  ],
});

class ProcessorTest implements Processor {
  readonly id: string = 'processor-test';
  readonly name?: string = 'Processor Test';
  readonly description?: string = 'A test processor that modifies messages';

  processInput(args: ProcessInputArgs<unknown>): ProcessInputResult {
    // Prepend "[INPUT PROCESSED]" to each message content
    const processedMessages = args.messages.map(msg => {
      // Handle MastraMessageContentV2 format
      if (msg.content && typeof msg.content === 'object' && 'format' in msg.content && msg.content.format === 2) {
        // Find text parts and modify them
        const modifiedParts = msg.content.parts.map(part => {
          if ('text' in part && typeof part.text === 'string') {
            return {
              ...part,
              text: `[INPUT PROCESSED] ${part.text}`,
            };
          }
          return part;
        });

        return {
          ...msg,
          content: {
            ...msg.content,
            parts: modifiedParts,
          },
        };
      }
      // Fallback for string content (shouldn't happen in practice)
      else if (typeof msg.content === 'string') {
        return {
          ...msg,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: `[INPUT PROCESSED] ${msg.content}` }],
          } as MastraMessageContentV2,
        };
      }
      return msg;
    });

    // Return the modified messages array
    return processedMessages;
  }

  processOutputResult(args: ProcessOutputResultArgs<unknown>): ProcessorMessageResult {
    // Append "[OUTPUT PROCESSED]" to the last assistant message
    const processedMessages = args.messages.map((msg, index) => {
      if (index === args.messages.length - 1 && msg.role === 'assistant') {
        // Handle MastraMessageContentV2 format
        if (msg.content && typeof msg.content === 'object' && 'format' in msg.content && msg.content.format === 2) {
          // Find text parts and modify them
          const modifiedParts = msg.content.parts.map(part => {
            if ('text' in part && typeof part.text === 'string') {
              return {
                ...part,
                text: `${part.text} [OUTPUT PROCESSED]`,
              };
            }
            return part;
          });

          return {
            ...msg,
            content: {
              ...msg.content,
              parts: modifiedParts,
            },
          };
        }
      }
      return msg;
    });

    // Return the modified messages array
    return processedMessages;
  }
}

const processorTestProvider: ProcessorProvider = {
  info: { id: 'processor-test', name: 'Processor Test' },
  configSchema: z.object({}),
  availablePhases: ['processInput', 'processOutputResult'],
  createProcessor: () => new ProcessorTest(),
};

const weatherAgent = new Agent({
  id: 'weather-assistant',
  name: 'Weather Assistant',
  description: 'An assistant that helps with weather information',
  instructions: 'You are a helpful weather assistant. Use the weather tool to get weather information when asked.',
  model: createMockLLM([
    {
      toolCall: {
        name: 'weather-tool',
        args: { city: 'London' },
      },
    },
    {
      text: 'The weather in London is sunny with a temperature of 20°C.',
    },
  ]),
  tools: {
    'weather-tool': weatherTool,
  },
});

const userAgent = new Agent({
  id: 'user-assistant',
  name: 'User Assistant',
  description: 'An assistant that helps find user information',
  instructions: 'You are a helpful assistant that can search for users by name.',
  model: createMockLLM([
    {
      text: 'I can help you find user information. Let me search for John Doe.',
    },
  ]),
  tools: {
    'user-search': userSearchTool,
  },
});

// // Mock scorer
const accuracyScorer = createScorer({
  id: 'accuracy-scorer',
  name: 'Accuracy Scorer',
  description: 'Scores the accuracy of responses',
  type: 'agent',
  judge: {
    model: createMockLLM([
      {
        text: 'The output is a perfect match for the expected output.',
      },
    ]),
    instructions: 'You are an expert evaluator that scores the accuracy of responses.',
  },
});

// Complex agent with all primitives
const complexAgent = new Agent({
  id: 'complex-assistant',
  name: 'Complex Assistant',
  description: 'An assistant with all primitives',
  instructions: 'You are a powerful assistant with access to multiple tools and workflows.',
  model: createMockLLM([
    {
      text: 'I can help with weather, user search, and order processing.',
    },
  ]),
  tools: {
    'weather-tool': weatherTool,
    'user-search': userSearchTool,
  },
  workflows: {
    'greeting-workflow': greetingWorkflow,
    'process-order': processOrderWorkflow,
  },
  agents: {
    'weather-agent': weatherAgent,
    'user-agent': userAgent,
  },
  scorers: {
    'accuracy-scorer': {
      scorer: accuracyScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
  defaultOptions: {
    maxSteps: 5,
    onStepFinish: () => {},
  },
});

describe('MastraEditor with LibSQL Integration', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    // Set mock API keys
    process.env.MOCK_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-openai-key'; // Mock OpenAI key for embeddings

    // Create fresh storage for each test
    storage = createTestStorage();
    editor = new MastraEditor({
      processorProviders: {
        'processor-test': processorTestProvider,
      },
    });

    mastra = new Mastra({
      storage,
      editor,
      tools: {
        'weather-tool': weatherTool,
        'user-search': userSearchTool,
      },
      workflows: {
        'greeting-workflow': greetingWorkflow,
        'process-order': processOrderWorkflow,
      },
      agents: {
        'weather-assistant': weatherAgent,
        'user-assistant': userAgent,
        'complex-assistant': complexAgent,
      },
      scorers: {
        'accuracy-scorer': accuracyScorer,
      },
      processors: {
        'processor-test': new ProcessorTest(),
      },
      gateways: {
        'models.dev': new MockGateway(),
      },
      vectors: {
        'libsql-vector-db': createTestVector('libsql-vector-db'),
        'pinecone-vector-db': createTestVector('pinecone-vector-db'),
        'chroma-vector-db': createTestVector('chroma-vector-db'),
      },
      // logger: console,
    });

    // Wait for storage initialization
    await storage.init();
  });

  afterEach(() => {
    // Clean up environment variable
    delete process.env.MOCK_API_KEY;
  });

  describe('Basic Agent Storage and Retrieval', () => {
    it('should store and retrieve a simple agent', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a test assistant',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const retrievedAgent = await editor.agent.getById('test-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('test-agent');
      expect(retrievedAgent?.name).toBe('Test Agent');
    });

    it('should handle agent with tools', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'tool-agent',
          name: 'Tool Agent',
          instructions: 'You are an assistant with tools',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: ['weather-tool', 'user-search'],
        },
      });

      const retrievedAgent = await editor.agent.getById('tool-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('tool-agent');

      // Verify tools are resolved
      const tools = await retrievedAgent?.listTools();
      expect(Object.keys(tools || {})).toContain('weather-tool');
      expect(Object.keys(tools || {})).toContain('user-search');
    });

    it('should handle agent with workflows', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'workflow-agent',
          name: 'Workflow Agent',
          instructions: 'You are an assistant with workflows',
          model: { provider: 'openai', name: 'gpt-4' },
          workflows: ['greeting-workflow', 'process-order'],
        },
      });

      const retrievedAgent = await editor.agent.getById('workflow-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('workflow-agent');

      // Check that workflows are available via listWorkflows
      const workflows = await retrievedAgent?.listWorkflows();
      expect(Object.keys(workflows || {})).toContain('greeting-workflow');
      expect(Object.keys(workflows || {})).toContain('process-order');
    });

    it('should handle agent with nested agents', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'parent-agent',
          name: 'Parent Agent',
          instructions: 'You are an assistant with sub-agents',
          model: { provider: 'openai', name: 'gpt-4' },
          agents: ['weather-assistant', 'user-assistant'],
        },
      });

      const retrievedAgent = await editor.agent.getById('parent-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('parent-agent');

      // Check that nested agents are available via listAgents
      const agents = await retrievedAgent?.listAgents();
      expect(Object.keys(agents || {})).toContain('weather-assistant');
      expect(Object.keys(agents || {})).toContain('user-assistant');
    });

    it('should handle agent with scorers', async () => {
      const agentsStore = await storage.getStore('agents');

      const createdAgent = await agentsStore?.create({
        agent: {
          id: 'scored-agent',
          name: 'Scored Agent',
          instructions: 'You are an assistant with scorers',
          model: { provider: 'openai', name: 'gpt-4' },
          scorers: {
            'accuracy-scorer': {}, // Empty config means use default sampling
          },
        },
      });

      // Activate the version
      if (createdAgent && 'versionId' in createdAgent) {
        await agentsStore?.update({
          id: 'scored-agent',
          activeVersionId: createdAgent.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('scored-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('scored-agent');

      // Test that scorers work by generating with returnScorerData
      const result = await retrievedAgent?.generate([{ role: 'user', content: 'What is the capital of France?' }], {
        returnScorerData: true,
      });

      // When returnScorerData is true, scorers should be invoked
      expect(result).toBeDefined();
      expect(result?.text).toBeDefined();
      expect(result?.scoringData).toBeDefined();
      expect(result?.scoringData?.input).toBeDefined();
      expect(result?.scoringData?.output).toBeDefined();
    });

    it('should handle agent with processors', async () => {
      const agentsStore = await storage.getStore('agents');

      const created = await agentsStore?.create({
        agent: {
          id: 'processor-agent',
          name: 'Processor Agent',
          instructions: 'You are an assistant with processors',
          model: { provider: 'mock', name: 'structured-mock' },
          inputProcessors: {
            steps: [
              {
                type: 'step',
                step: {
                  id: 'processor-test-input',
                  providerId: 'processor-test',
                  config: {},
                  enabledPhases: ['processInput'],
                },
              },
            ],
          } satisfies StoredProcessorGraph,
          outputProcessors: {
            steps: [
              {
                type: 'step',
                step: {
                  id: 'processor-test-output',
                  providerId: 'processor-test',
                  config: {},
                  enabledPhases: ['processOutputResult'],
                },
              },
            ],
          } satisfies StoredProcessorGraph,
        },
      });

      // Activate version
      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'processor-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('processor-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);

      // Test that processors modify the input/output
      const result = await retrievedAgent?.generate('Hello world');

      const userMessage = result?.messages[0]?.content.parts[0]!;

      // The input processor should have modified the user message
      expect('text' in userMessage && userMessage.text).toContain('[INPUT PROCESSED]');
      // The output processor should have modified the response
      expect(result?.text).toContain('[OUTPUT PROCESSED]');
    });
  });

  describe('Complex Agent with All Primitives', () => {
    it('should store and retrieve a complex agent with all primitives', async () => {
      const agentsStore = await storage.getStore('agents');

      const created = await agentsStore?.create({
        agent: {
          id: 'all-primitives-agent',
          name: 'All Primitives Agent',
          description: 'An agent with all available primitives',
          instructions: 'You are a comprehensive assistant',
          model: { provider: 'mock', name: 'weather-mock' },
          tools: ['weather-tool', 'user-search'],
          workflows: ['greeting-workflow', 'process-order'],
          agents: ['weather-assistant', 'user-assistant'],
          scorers: {
            'accuracy-scorer': {},
          },
          inputProcessors: {
            steps: [
              {
                type: 'step',
                step: {
                  id: 'processor-test-input',
                  providerId: 'processor-test',
                  config: {},
                  enabledPhases: ['processInput'],
                },
              },
            ],
          } satisfies StoredProcessorGraph,
          outputProcessors: {
            steps: [
              {
                type: 'step',
                step: {
                  id: 'processor-test-output',
                  providerId: 'processor-test',
                  config: {},
                  enabledPhases: ['processOutputResult'],
                },
              },
            ],
          } satisfies StoredProcessorGraph,

          defaultOptions: {
            maxSteps: 10,
          },
          metadata: {
            version: '1.0',
            tags: ['test', 'complex'],
          },
        },
      });

      // Activate version
      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'all-primitives-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('all-primitives-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('all-primitives-agent');
      expect(retrievedAgent?.name).toBe('All Primitives Agent');
      expect(retrievedAgent?.getDescription()).toBe('An agent with all available primitives');

      // Verify all primitives are resolved
      const tools = await retrievedAgent?.listTools();
      expect(Object.keys(tools || {})).toContain('weather-tool');
      expect(Object.keys(tools || {})).toContain('user-search');

      const workflows = await retrievedAgent?.listWorkflows();
      expect(Object.keys(workflows || {})).toContain('greeting-workflow');
      expect(Object.keys(workflows || {})).toContain('process-order');

      const agents = await retrievedAgent?.listAgents();
      expect(Object.keys(agents || {})).toContain('weather-assistant');
      expect(Object.keys(agents || {})).toContain('user-assistant');

      // Test execution with all features active
      const result = await retrievedAgent?.generate('What is the weather in Tokyo?');
      expect(result?.text).toBeDefined();
    });

    it('should execute a stored agent with tools', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create an agent with weather tool - use weather-mock model which includes tool calls
      const created = await agentsStore?.create({
        agent: {
          id: 'executable-agent',
          name: 'Executable Agent',
          instructions: 'You are a weather assistant. Always use the weather tool when asked about weather.',
          model: { provider: 'mock', name: 'weather-mock' },
          tools: ['weather-tool'],
        },
      });

      // Activate the version
      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'executable-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('executable-agent');

      // Add the agent to mastra instance so it can resolve models
      if (retrievedAgent) {
        mastra.addAgent(retrievedAgent, 'executable-agent');
      }

      expect(retrievedAgent).toBeInstanceOf(Agent);

      // Test 1: Verify the tool is available on the agent
      const tools = await retrievedAgent?.listTools();
      expect(tools).toHaveProperty('weather-tool');

      // Test 2: Execute the agent and verify it uses the tool
      const response = await retrievedAgent!.generate('What is the weather in Paris?');
      expect(response.text).toContain('Paris');
      expect(response.text).toContain('sunny'); // weather-tool returns "sunny and 22°C"
      expect(response.text).toContain('22°C');

      // Test 3: Test the tool directly to ensure it's properly resolved
      const weatherTool = tools?.['weather-tool'];
      if (weatherTool && 'execute' in weatherTool && weatherTool.execute) {
        const directResult = await weatherTool.execute({ city: 'London' }, { mastra, agent: retrievedAgent! });
        expect(directResult).toBe('The weather in London is sunny and 22°C');
      }
    });
  });

  describe('Agent Versioning', () => {
    it('should handle multiple versions of an agent', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create initial version
      await agentsStore?.create({
        agent: {
          id: 'versioned-agent',
          name: 'Version 1',
          instructions: 'You are version 1',
          model: { provider: 'openai', name: 'gpt-3.5-turbo' },
        },
      });

      // Config changes require createVersion + update(activeVersionId)
      await agentsStore?.createVersion({
        id: randomUUID(),
        agentId: 'versioned-agent',
        versionNumber: 2,
        name: 'Version 2',
        instructions: 'You are version 2',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name', 'instructions', 'model'],
      });

      // Get the latest version and activate it
      const latestVersion = await agentsStore?.getLatestVersion('versioned-agent');
      await agentsStore?.update({
        id: 'versioned-agent',
        activeVersionId: latestVersion!.id,
        status: 'published',
      });
      editor.agent.clearCache('versioned-agent');

      // Retrieve latest version (should be version 2)
      const latestAgent = await editor.agent.getById('versioned-agent');
      expect(latestAgent?.name).toBe('Version 2');

      // Retrieve specific version
      const versions = await agentsStore?.listVersions({ agentId: 'versioned-agent' });
      const firstVersion = versions?.versions.find(v => v.versionNumber === 1);

      if (firstVersion) {
        const version1Agent = await editor.agent.getById('versioned-agent', {
          versionId: firstVersion.id,
        });
        expect(version1Agent?.name).toBe('Version 1');
      } else {
        throw new Error('First version not found');
      }
    });

    it('should retrieve agent by version number', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create initial version
      await agentsStore?.create({
        agent: {
          id: 'numbered-version-agent',
          name: 'Version 1',
          instructions: 'You are version 1',
          model: { provider: 'openai', name: 'gpt-3.5-turbo' },
        },
      });

      // Config changes require createVersion + update(activeVersionId)
      await agentsStore?.createVersion({
        id: randomUUID(),
        agentId: 'numbered-version-agent',
        versionNumber: 2,
        name: 'Version 2',
        instructions: 'You are version 2',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name', 'instructions', 'model'],
      });

      const latestVersion = await agentsStore?.getLatestVersion('numbered-version-agent');
      await agentsStore?.update({
        id: 'numbered-version-agent',
        activeVersionId: latestVersion!.id,
        status: 'published',
      });
      editor.agent.clearCache('numbered-version-agent');

      // Retrieve by version number
      const version1Agent = await editor.agent.getById('numbered-version-agent', {
        versionNumber: 1,
      });
      expect(version1Agent?.name).toBe('Version 1');

      const version2Agent = await editor.agent.getById('numbered-version-agent', {
        versionNumber: 2,
      });
      expect(version2Agent?.name).toBe('Version 2');
    });
  });

  describe('List Stored Agents', () => {
    it('should list all stored agents with pagination', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create multiple agents
      for (let i = 1; i <= 5; i++) {
        const createdAgent = await agentsStore?.create({
          agent: {
            id: `list-agent-${i}`,
            name: `List Agent ${i}`,
            instructions: `You are agent number ${i}`,
            model: { provider: 'openai', name: 'gpt-4' },
          },
        });

        // Get the first version that was created and activate it
        const versions = await agentsStore?.listVersions({ agentId: `list-agent-${i}` });
        if (versions?.versions[0]) {
          await agentsStore?.update({
            id: `list-agent-${i}`,
            activeVersionId: versions.versions[0].id,
          });
        }
      }

      // First, check raw agents to debug
      const rawAgents = await editor.agent.list();

      // Only consider agents that we created in this test
      const testAgentIds = ['list-agent-1', 'list-agent-2', 'list-agent-3', 'list-agent-4', 'list-agent-5'];
      const validAgents = rawAgents.agents.filter(a => testAgentIds.includes(a.id));

      if (validAgents.length !== 5) {
        throw new Error(`Expected 5 test agents but found ${validAgents.length}`);
      }

      // List with pagination
      const page1 = await editor.agent.list({ perPage: 3 });
      expect(page1.agents).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      // Don't check exact total - there might be agents from other tests
      expect(page1.total).toBeGreaterThanOrEqual(5);

      // Get page 2 (0-based, so page: 1 is the second page)
      try {
        const page2 = await editor.agent.list({
          perPage: 3,
          page: 1,
        });
        expect(page2.agents).toHaveLength(2);
        expect(page2.hasMore).toBe(false);
      } catch (error) {
        console.error('Error listing page 2:', error);
        // List all raw agents to debug
        const rawAgents = await editor.agent.list();
        console.log(
          'All raw agents:',
          rawAgents.agents.map(a => ({
            id: a.id,
            status: a.status,
            activeVersionId: a.activeVersionId,
          })),
        );
        throw error;
      }
    });

    it('should return raw agent data when requested', async () => {
      const agentsStore = await storage.getStore('agents');

      const createdAgent = await agentsStore?.create({
        agent: {
          id: 'raw-list-agent',
          name: 'Raw List Agent',
          instructions: 'You are a raw agent',
          model: { provider: 'openai', name: 'gpt-4' },
          metadata: { custom: 'data' },
        },
      });

      // Activate the first version
      const versions = await agentsStore?.listVersions({ agentId: 'raw-list-agent' });
      if (versions?.versions[0]) {
        await agentsStore?.update({
          id: 'raw-list-agent',
          activeVersionId: versions.versions[0].id,
        });
      }

      const rawResult = await editor.agent.list();

      expect(rawResult.agents[0]).not.toBeInstanceOf(Agent);
      expect(rawResult.agents[0]?.id).toBe('raw-list-agent');
      // Raw data returns Date objects from storage
      expect(rawResult.agents[0]?.createdAt).toBeTruthy();
      // Metadata handling - skip for now due to libsql encoding issues
      const metadata = rawResult.agents[0]?.metadata;
      expect(metadata).toEqual({ custom: 'data' });
    });
  });

  describe('Cache Management', () => {
    it('should cache and clear cached agents', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'cached-agent',
          name: 'Cached Agent',
          instructions: 'You are a cached agent',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      // First retrieval (should cache)
      const agent1 = await editor.agent.getById('cached-agent');
      expect(agent1?.name).toBe('Cached Agent');

      // Update the agent in storage — config changes require createVersion + update(activeVersionId)
      await agentsStore?.createVersion({
        id: randomUUID(),
        agentId: 'cached-agent',
        versionNumber: 2,
        name: 'Updated Cached Agent',
        instructions: 'You are a cached agent',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name'],
      });

      // Get the latest version and activate it
      const latestVersion = await agentsStore?.getLatestVersion('cached-agent');
      await agentsStore?.update({
        id: 'cached-agent',
        activeVersionId: latestVersion!.id,
        status: 'published',
      });

      // Retrieve again (should get cached version)
      const agent2 = await editor.agent.getById('cached-agent');
      expect(agent2?.name).toBe('Cached Agent');

      // Clear cache
      await editor.agent.clearCache('cached-agent');

      // Retrieve again (should get updated version)
      const agent3 = await editor.agent.getById('cached-agent');
      expect(agent3?.name).toBe('Updated Cached Agent');
    });

    it('should clear all cached agents', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create multiple agents
      await agentsStore?.create({
        agent: {
          id: 'cache-test-1',
          name: 'Cache Test 1',
          instructions: 'First agent',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      await agentsStore?.create({
        agent: {
          id: 'cache-test-2',
          name: 'Cache Test 2',
          instructions: 'Second agent',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      // Retrieve to cache
      await editor.agent.getById('cache-test-1');
      await editor.agent.getById('cache-test-2');

      // Clear all cache
      await editor.agent.clearCache();

      // Verify cache is cleared by updating and retrieving
      // Config changes require createVersion + update(activeVersionId)
      await agentsStore?.createVersion({
        id: randomUUID(),
        agentId: 'cache-test-1',
        versionNumber: 2,
        name: 'Updated 1',
        instructions: 'First agent',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name'],
      });
      const latestVersion1 = await agentsStore?.getLatestVersion('cache-test-1');
      await agentsStore?.update({
        id: 'cache-test-1',
        activeVersionId: latestVersion1!.id,
        status: 'published',
      });

      await agentsStore?.createVersion({
        id: randomUUID(),
        agentId: 'cache-test-2',
        versionNumber: 2,
        name: 'Updated 2',
        instructions: 'Second agent',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name'],
      });
      const latestVersion2 = await agentsStore?.getLatestVersion('cache-test-2');
      await agentsStore?.update({
        id: 'cache-test-2',
        activeVersionId: latestVersion2!.id,
        status: 'published',
      });

      const agent1 = await editor.agent.getById('cache-test-1');
      const agent2 = await editor.agent.getById('cache-test-2');

      expect(agent1?.name).toBe('Updated 1');
      expect(agent2?.name).toBe('Updated 2');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tools gracefully', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'missing-tools-agent',
          name: 'Missing Tools Agent',
          instructions: 'You have missing tools',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: ['non-existent-tool'],
        },
      });

      const agent = await editor.agent.getById('missing-tools-agent');

      expect(agent).toBeInstanceOf(Agent);
      const tools = await agent?.listTools();
      expect(Object.keys(tools || {})).not.toContain('non-existent-tool');
    });

    it('should handle missing workflows gracefully', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'missing-workflows-agent',
          name: 'Missing Workflows Agent',
          instructions: 'You have missing workflows',
          model: { provider: 'openai', name: 'gpt-4' },
          workflows: ['non-existent-workflow'],
        },
      });

      const agent = await editor.agent.getById('missing-workflows-agent');

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle missing nested agents gracefully', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'missing-agents-agent',
          name: 'Missing Agents Agent',
          instructions: 'You have missing nested agents',
          model: { provider: 'openai', name: 'gpt-4' },
          agents: ['non-existent-agent'],
        },
      });

      const agent = await editor.agent.getById('missing-agents-agent');

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle invalid model configuration', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'invalid-model-agent',
          name: 'Invalid Model Agent',
          instructions: 'You have an invalid model',
          model: { invalid: 'config' } as any,
        },
      });

      await expect(editor.agent.getById('invalid-model-agent')).rejects.toThrow('invalid model configuration');
    });
  });

  describe('Agent Registration', () => {
    it('should register stored agents with Mastra', async () => {
      const agentsStore = await storage.getStore('agents');

      const createdAgent = await agentsStore?.create({
        agent: {
          id: 'registered-agent',
          name: 'Registered Agent',
          instructions: 'You should be registered',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      // Activate the first version
      const versions = await agentsStore?.listVersions({ agentId: 'registered-agent' });
      if (versions?.versions[0]) {
        await agentsStore?.update({
          id: 'registered-agent',
          activeVersionId: versions.versions[0].id,
        });
      }

      const agent = await editor.agent.getById('registered-agent');

      // Check that the agent can be retrieved and is properly configured
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('registered-agent');
      expect(agent?.name).toBe('Registered Agent');

      // Verify the agent has Mastra primitives registered
      expect(agent?.source).toBe('stored');
    });
  });

  describe('Agent with Default Options', () => {
    it('should store and use defaultOptions in agent execution', async () => {
      const agentsStore = await storage.getStore('agents');

      const created = await agentsStore?.create({
        agent: {
          id: 'default-options-agent',
          name: 'Default Options Agent',
          instructions: 'You are an assistant with default execution options',
          model: { provider: 'mock', name: 'structured-mock' },
          defaultOptions: {
            maxSteps: 5,
            tracingOptions: {
              metadata: {
                environment: 'test',
                feature: 'defaultOptions',
              },
            },
            returnScorerData: true,
            includeRawChunks: true,
            maxProcessorRetries: 3,
            requireToolApproval: false,
            autoResumeSuspendedTools: true,
            toolCallConcurrency: 5,
            savePerStep: false,
            runId: 'default-run-123',
          },
          scorers: {
            'accuracy-scorer': {},
          },
        },
      });

      // Activate version
      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'default-options-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('default-options-agent');

      // Add to mastra
      if (retrievedAgent) {
        mastra.addAgent(retrievedAgent, 'default-options-agent');
      }

      expect(retrievedAgent).toBeInstanceOf(Agent);

      // Verify defaultOptions are preserved in storage
      const rawAgentInstance = await editor.agent.getById('default-options-agent');
      const rawAgent = rawAgentInstance?.toRawConfig();
      expect(rawAgent?.defaultOptions).toEqual({
        maxSteps: 5,
        tracingOptions: {
          metadata: {
            environment: 'test',
            feature: 'defaultOptions',
          },
        },
        returnScorerData: true,
        includeRawChunks: true,
        maxProcessorRetries: 3,
        requireToolApproval: false,
        autoResumeSuspendedTools: true,
        toolCallConcurrency: 5,
        savePerStep: false,
        runId: 'default-run-123',
      });

      // Verify default options are applied during execution
      const result = await retrievedAgent?.generate('Hello, test the default options');
      expect(result?.text).toContain('location');
      // Note: scoringData would be populated if scoring actually runs,
      // which requires proper scorer execution setup
    });
  });

  describe('Agent with Memory', () => {
    it('should create and retrieve an agent with static memory configuration', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create an agent with static memory configuration
      const created = await agentsStore?.create({
        agent: {
          id: 'memory-agent',
          name: 'Memory Agent',
          instructions: 'You are an assistant with memory capabilities',
          model: { provider: 'mock', name: 'mock-model' },
          tools: ['weather-tool'],
          memory: {
            vector: 'libsql-vector-db',
            options: {
              lastMessages: 10,
              generateTitle: {
                model: 'mock/mock-model',
                instructions: 'Generate a concise title (max 5 words)',
              },
            },
          },
        },
      });

      // Activate version
      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'memory-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('memory-agent');

      expect(retrievedAgent).toBeInstanceOf(Agent);
      expect(retrievedAgent?.id).toBe('memory-agent');
      expect(retrievedAgent?.name).toBe('Memory Agent');

      // Check that the agent was created with memory configuration
      // The actual memory instance would be resolved by the editor when creating the agent
      const rawAgentInstance = await editor.agent.getById('memory-agent');
      const rawAgent = rawAgentInstance?.toRawConfig() as any;
      expect(rawAgent?.memory).toEqual({
        vector: 'libsql-vector-db',
        // embedder: 'openai/text-embedding-3-small',
        options: {
          lastMessages: 10,
          // semanticRecall: {
          //   topK: 5,
          //   messageRange: 2,
          //   scope: 'resource',
          // },
          generateTitle: {
            model: 'mock/mock-model',
            instructions: 'Generate a concise title (max 5 words)',
          },
        },
      });

      // Generate messages to create memory entries
      const threadId = `thread-${Date.now()}`;
      const result1 = await retrievedAgent?.generate('First message to test memory', {
        memory: {
          resource: 'memory-agent',
          thread: { id: threadId },
        },
      });
      const result2 = await retrievedAgent?.generate('Second message about memory', {
        memory: {
          resource: 'memory-agent',
          thread: { id: threadId },
        },
      });

      // Verify responses
      expect(result1?.text).toBeDefined();
      expect(result2?.text).toBeDefined();

      // Give time for async embedding creation to complete
      // The SemanticRecall processor runs in processOutputResult which happens after generation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if there were any errors during embedding creation
      // Let's re-check the logs

      // Debug: Check if the agent has a memory instance
      const memory = await retrievedAgent?.getMemory();
      console.log('Agent memory exists?', memory !== undefined);

      // Debug: Check if semantic recall is configured
      const memoryConfig = (memory as any)?.config;
      console.log('Memory config:', memoryConfig?.semanticRecall);

      // Verify thread was created in storage
      const thread = await memory?.getThreadById({ threadId });
      expect(thread?.id).toBe(threadId);

      // Verify messages were saved in storage
      const messages = await memory?.recall({
        threadId,
        resourceId: 'memory-agent',
      });
      expect(messages?.messages.length).toBeGreaterThanOrEqual(4); // At least 2 user + 2 assistant messages

      // Check message content
      const userMessages = messages?.messages.filter(m => m.role === 'user');
      const assistantMessages = messages?.messages.filter(m => m.role === 'assistant');
      expect(userMessages?.length).toBeGreaterThanOrEqual(2);
      expect(assistantMessages?.length).toBeGreaterThanOrEqual(2);

      // Verify embeddings were created (if indexes are created)
      const vectorStore = mastra.getVector('libsql-vector-db');

      // Check if the vector store exists
      expect(vectorStore).toBeDefined();

      // List all indexes to see what's created
      const indexes = await vectorStore?.listIndexes();
      console.log('indexes', indexes);

      // @TODO: verify that embeddings were created
      // For now, let's just verify that messages were saved
      expect(messages?.messages.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle streaming with stored agents', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'streaming-agent',
          name: 'Streaming Agent',
          instructions: 'You are a streaming assistant',
          model: { provider: 'mock', name: 'structured-mock' },
          tools: ['weather-tool'],
        },
      });

      // Activate version
      const versions = await agentsStore?.listVersions({ agentId: 'streaming-agent' });
      if (versions?.versions[0]) {
        await agentsStore?.update({
          id: 'streaming-agent',
          activeVersionId: versions.versions[0].id,
        });
      }

      const agent = await editor.agent.getById('streaming-agent');
      mastra.addAgent(agent!, 'streaming-agent');

      // Test streaming
      const stream = await agent?.stream('Stream the weather');
      expect(stream).toBeDefined();

      // Verify stream exists (we can't iterate in tests as MockLanguageModelV2 doesn't provide async iterator)
      expect(stream).toBeDefined();
    });

    it('should handle multiple tool calls in a single step', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'multi-tool-agent',
          name: 'Multi Tool Agent',
          instructions: 'You use multiple tools efficiently',
          model: { provider: 'mock', name: 'structured-mock' },
          tools: ['weather-tool', 'user-search'],
          defaultOptions: {
            maxSteps: 10,
          },
        },
      });

      // Activate version
      const versions = await agentsStore?.listVersions({ agentId: 'multi-tool-agent' });
      if (versions?.versions[0]) {
        await agentsStore?.update({
          id: 'multi-tool-agent',
          activeVersionId: versions.versions[0].id,
        });
      }

      const agent = await editor.agent.getById('multi-tool-agent');
      mastra.addAgent(agent!, 'multi-tool-agent');

      const result = await agent?.generate('Get weather for all our users', {
        maxSteps: 3,
      });

      expect(result).toBeDefined();
    });

    it('should work with agents that have metadata', async () => {
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'metadata-agent',
          name: 'Metadata Agent',
          instructions: 'You have metadata',
          model: { provider: 'mock', name: 'structured-mock' },
          metadata: {
            version: '2.0',
            tags: ['production', 'critical'],
            deployment: {
              environment: 'prod',
              region: 'us-east-1',
            },
          },
        },
      });

      const rawAgentInstance = await editor.agent.getById('metadata-agent');
      const rawAgent = rawAgentInstance?.toRawConfig();

      expect(rawAgent?.metadata).toEqual({
        version: '2.0',
        tags: ['production', 'critical'],
        deployment: {
          environment: 'prod',
          region: 'us-east-1',
        },
      });
    });

    it('should create agent with vector memory configuration', async () => {
      const agentsStore = await storage.getStore('agents');

      // Create an agent with vector memory
      await agentsStore?.create({
        agent: {
          id: 'vector-memory-agent',
          name: 'Vector Memory Agent',
          instructions: 'You are an assistant with vector memory for RAG',
          model: { provider: 'anthropic', name: 'claude-3-opus' },
          memory: {
            vector: 'chroma-vector-db',
            options: {
              lastMessages: 15,
              semanticRecall: {
                topK: 10,
                messageRange: { before: 2, after: 3 },
                scope: 'thread',
              },
              generateTitle: {
                model: 'mock/mock-model',
                instructions: 'Generate a concise title (max 5 words)',
              },
            },
          },
        },
      });

      const rawAgentInstance = await editor.agent.getById('vector-memory-agent');
      const rawAgent = rawAgentInstance?.toRawConfig();

      expect(rawAgent?.memory).toEqual({
        vector: 'chroma-vector-db',
        options: {
          lastMessages: 15,
          semanticRecall: {
            topK: 10,
            messageRange: { before: 2, after: 3 },
            scope: 'thread',
          },
          generateTitle: {
            model: 'mock/mock-model',
            instructions: 'Generate a concise title (max 5 words)',
          },
        },
      });
    });
  });

  describe('Prompt Block Instructions E2E', () => {
    it('should create prompt blocks and use them as agent instructions', async () => {
      // Create prompt blocks via the editor
      const greetingBlock = await editor.prompt.create({
        id: 'greeting-block',
        name: 'Greeting Block',
        description: 'A greeting prompt block',
        content: 'You are a helpful assistant called {{agentName}}.',
      });

      expect(greetingBlock).toBeDefined();
      expect(greetingBlock.id).toBe('greeting-block');
      expect(greetingBlock.name).toBe('Greeting Block');
      expect(greetingBlock.content).toBe('You are a helpful assistant called {{agentName}}.');

      const behaviorBlock = await editor.prompt.create({
        id: 'behavior-block',
        name: 'Behavior Block',
        description: 'A behavior prompt block',
        content: 'Always be polite and concise in your responses.',
      });

      expect(behaviorBlock).toBeDefined();
      expect(behaviorBlock.id).toBe('behavior-block');

      // Publish both blocks
      await editor.prompt.update({ id: 'greeting-block', status: 'published' });
      await editor.prompt.update({ id: 'behavior-block', status: 'published' });

      // Create a stored agent that uses prompt block instructions
      const agentsStore = await storage.getStore('agents');
      const created = await agentsStore?.create({
        agent: {
          id: 'prompt-block-agent',
          name: 'Prompt Block Agent',
          instructions: [
            { type: 'prompt_block_ref', id: 'greeting-block' },
            { type: 'text', content: 'The user is called {{userName}}.' },
            { type: 'prompt_block_ref', id: 'behavior-block' },
          ],
          model: { provider: 'mock', name: 'mock-model' },
        },
      });

      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'prompt-block-agent',
          activeVersionId: created.versionId as string,
        });
      }

      // Clear the agent cache so it re-resolves
      editor.agent.clearCache('prompt-block-agent');

      // Retrieve the agent via editor — this triggers resolveStoredInstructions
      const retrievedAgent = await editor.agent.getById('prompt-block-agent');
      expect(retrievedAgent).toBeInstanceOf(Agent);

      // The instructions should be a function (DynamicArgument) since they contain prompt blocks
      // Verify by calling generate with a requestContext
      const ctx = new RequestContext([
        ['agentName', 'TestBot'],
        ['userName', 'Alice'],
      ]);

      const result = await retrievedAgent!.generate('Hello!', {
        requestContext: ctx,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('should resolve instructions differently based on requestContext', async () => {
      // Create a conditional prompt block with rules
      await editor.prompt.create({
        id: 'admin-block',
        name: 'Admin Instructions',
        description: 'Instructions for admin users',
        content: 'The user is an admin. You can share sensitive information.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.role', operator: 'equals', value: 'admin' }],
        },
      });
      await editor.prompt.update({ id: 'admin-block', status: 'published' });

      await editor.prompt.create({
        id: 'guest-block',
        name: 'Guest Instructions',
        description: 'Instructions for guest users',
        content: 'The user is a guest. Only share public information.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.role', operator: 'equals', value: 'guest' }],
        },
      });
      await editor.prompt.update({ id: 'guest-block', status: 'published' });

      await editor.prompt.create({
        id: 'base-block',
        name: 'Base Instructions',
        description: 'Base instructions',
        content: 'You are a helpful assistant. The user is {{user.name}}.',
      });
      await editor.prompt.update({ id: 'base-block', status: 'published' });

      // Preview instructions for an admin context
      const adminInstructions = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'base-block' },
          { type: 'prompt_block_ref', id: 'admin-block' },
          { type: 'prompt_block_ref', id: 'guest-block' },
        ],
        { user: { role: 'admin', name: 'AdminUser' } },
      );

      expect(adminInstructions).toContain('You are a helpful assistant. The user is AdminUser.');
      expect(adminInstructions).toContain('The user is an admin. You can share sensitive information.');
      expect(adminInstructions).not.toContain('The user is a guest');

      // Preview instructions for a guest context
      const guestInstructions = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'base-block' },
          { type: 'prompt_block_ref', id: 'admin-block' },
          { type: 'prompt_block_ref', id: 'guest-block' },
        ],
        { user: { role: 'guest', name: 'GuestUser' } },
      );

      expect(guestInstructions).toContain('You are a helpful assistant. The user is GuestUser.');
      expect(guestInstructions).not.toContain('The user is an admin');
      expect(guestInstructions).toContain('The user is a guest. Only share public information.');
    });

    it('should execute agent.generate() with dynamic instructions from prompt blocks', async () => {
      // Create prompt blocks
      await editor.prompt.create({
        id: 'system-block',
        name: 'System Block',
        content: 'You are {{assistant.name}}, a {{assistant.specialty}} assistant.',
      });
      await editor.prompt.update({ id: 'system-block', status: 'published' });

      await editor.prompt.create({
        id: 'auth-block',
        name: 'Authenticated User Block',
        content: 'The authenticated user is {{user.name}} ({{user.email}}).',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
        },
      });
      await editor.prompt.update({ id: 'auth-block', status: 'published' });

      // Create stored agent with prompt block instructions
      const agentsStore = await storage.getStore('agents');
      const created = await agentsStore?.create({
        agent: {
          id: 'dynamic-agent',
          name: 'Dynamic Agent',
          instructions: [
            { type: 'prompt_block_ref', id: 'system-block' },
            { type: 'prompt_block_ref', id: 'auth-block' },
            { type: 'text', content: 'Always respond in {{language || "English"}}.' },
          ],
          model: { provider: 'mock', name: 'mock-model' },
        },
      });

      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'dynamic-agent',
          activeVersionId: created.versionId as string,
        });
      }

      editor.agent.clearCache('dynamic-agent');

      // Generate with authenticated user context
      const agent = await editor.agent.getById('dynamic-agent');
      expect(agent).toBeInstanceOf(Agent);

      const authCtx = new RequestContext([
        ['assistant', { name: 'WeatherBot', specialty: 'weather' }],
        ['user', { isAuthenticated: true, name: 'John', email: 'john@example.com' }],
        ['language', 'French'],
      ]);

      const authResult = await agent!.generate('What is the weather?', {
        requestContext: authCtx,
      });

      // Verify the resolved system prompt includes all matching blocks with interpolated variables
      expect(authResult.text).toContain('You are WeatherBot, a weather assistant.');
      expect(authResult.text).toContain('The authenticated user is John (john@example.com).');
      expect(authResult.text).toContain('Always respond in French.');

      // Generate with unauthenticated user context — auth block should be excluded
      editor.agent.clearCache('dynamic-agent');
      const agent2 = await editor.agent.getById('dynamic-agent');

      const unauthCtx = new RequestContext([
        ['assistant', { name: 'WeatherBot', specialty: 'weather' }],
        ['user', { isAuthenticated: false, name: 'Anonymous' }],
      ]);

      const unauthResult = await agent2!.generate('What is the weather?', {
        requestContext: unauthCtx,
      });

      // Verify auth block is excluded and language falls back to default
      expect(unauthResult.text).toContain('You are WeatherBot, a weather assistant.');
      expect(unauthResult.text).not.toContain('The authenticated user is');
      expect(unauthResult.text).toContain('Always respond in English.');
    });

    it('should handle backward compatible string instructions alongside prompt blocks', async () => {
      const agentsStore = await storage.getStore('agents');

      // Agent with plain string instructions — backward compatible
      const created = await agentsStore?.create({
        agent: {
          id: 'string-instructions-agent',
          name: 'String Instructions Agent',
          instructions: 'You are a simple assistant with string instructions.',
          model: { provider: 'mock', name: 'mock-model' },
        },
      });

      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'string-instructions-agent',
          activeVersionId: created.versionId as string,
        });
      }

      const retrievedAgent = await editor.agent.getById('string-instructions-agent');
      expect(retrievedAgent).toBeInstanceOf(Agent);

      const result = await retrievedAgent!.generate('Hello!');
      expect(result).toBeDefined();
      expect(result.text).toContain('You are a simple assistant with string instructions.');
    });

    it('should handle mixed text and prompt_block instructions with variable interpolation', async () => {
      await editor.prompt.create({
        id: 'persona-block',
        name: 'Persona',
        content: 'You are {{persona.name}}, who works as a {{persona.job}}.',
      });
      await editor.prompt.update({ id: 'persona-block', status: 'published' });

      // Preview with context
      const result = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'persona-block' },
          { type: 'text', content: 'Help the user with their {{topic || "general"}} questions.' },
          { type: 'text', content: 'Be {{tone || "friendly"}} in your responses.' },
        ],
        {
          persona: { name: 'Dr. Smith', job: 'data scientist' },
          topic: 'machine learning',
        },
      );

      expect(result).toContain('You are Dr. Smith, who works as a data scientist.');
      expect(result).toContain('Help the user with their machine learning questions.');
      expect(result).toContain('Be friendly in your responses.'); // fallback used
    });

    it('should skip unpublished prompt blocks', async () => {
      // Create a draft block (default status)
      await editor.prompt.create({
        id: 'draft-block',
        name: 'Draft Block',
        content: 'This is a draft block that should not appear.',
      });
      // Do NOT publish it

      await editor.prompt.create({
        id: 'published-block',
        name: 'Published Block',
        content: 'This is a published block.',
      });
      await editor.prompt.update({ id: 'published-block', status: 'published' });

      const result = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'draft-block' },
          { type: 'prompt_block_ref', id: 'published-block' },
        ],
        {},
      );

      expect(result).not.toContain('draft block');
      expect(result).toContain('This is a published block.');
    });

    it('should skip prompt blocks whose rules do not match', async () => {
      await editor.prompt.create({
        id: 'premium-block',
        name: 'Premium Features',
        content: 'You can access premium features like advanced analytics.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'subscription', operator: 'equals', value: 'premium' }],
        },
      });
      await editor.prompt.update({ id: 'premium-block', status: 'published' });

      await editor.prompt.create({
        id: 'free-block',
        name: 'Free Features',
        content: 'You can only access basic features.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'subscription', operator: 'equals', value: 'free' }],
        },
      });
      await editor.prompt.update({ id: 'free-block', status: 'published' });

      // Premium user
      const premiumResult = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'premium-block' },
          { type: 'prompt_block_ref', id: 'free-block' },
        ],
        { subscription: 'premium' },
      );

      expect(premiumResult).toContain('advanced analytics');
      expect(premiumResult).not.toContain('basic features');

      // Free user
      const freeResult = await editor.prompt.preview(
        [
          { type: 'prompt_block_ref', id: 'premium-block' },
          { type: 'prompt_block_ref', id: 'free-block' },
        ],
        { subscription: 'free' },
      );

      expect(freeResult).not.toContain('advanced analytics');
      expect(freeResult).toContain('basic features');
    });

    it('should handle OR rules correctly', async () => {
      await editor.prompt.create({
        id: 'staff-block',
        name: 'Staff Block',
        content: 'You can manage internal resources.',
        rules: {
          operator: 'OR',
          conditions: [
            { field: 'role', operator: 'equals', value: 'admin' },
            { field: 'role', operator: 'equals', value: 'moderator' },
          ],
        },
      });
      await editor.prompt.update({ id: 'staff-block', status: 'published' });

      // Admin gets it
      const adminResult = await editor.prompt.preview([{ type: 'prompt_block_ref', id: 'staff-block' }], {
        role: 'admin',
      });
      expect(adminResult).toContain('manage internal resources');

      // Moderator gets it
      const modResult = await editor.prompt.preview([{ type: 'prompt_block_ref', id: 'staff-block' }], {
        role: 'moderator',
      });
      expect(modResult).toContain('manage internal resources');

      // Regular user does not get it
      const userResult = await editor.prompt.preview([{ type: 'prompt_block_ref', id: 'staff-block' }], {
        role: 'user',
      });
      expect(userResult).not.toContain('manage internal resources');
    });

    it('should handle prompt block versioning', async () => {
      // Create initial version
      const block = await editor.prompt.create({
        id: 'versioned-block',
        name: 'Versioned Block',
        content: 'Version 1 content',
      });
      await editor.prompt.update({ id: 'versioned-block', status: 'published' });

      // Verify initial content
      const v1 = await editor.prompt.preview([{ type: 'prompt_block_ref', id: 'versioned-block' }], {});
      expect(v1).toBe('Version 1 content');

      // Config changes require createVersion + update(activeVersionId)
      const promptStore = await storage.getStore('promptBlocks');
      await promptStore?.createVersion({
        id: randomUUID(),
        blockId: 'versioned-block',
        versionNumber: 2,
        name: 'Versioned Block',
        content: 'Version 2 content',
        changedFields: ['content'],
      });
      const latestVersion = await promptStore?.getLatestVersion('versioned-block');
      await promptStore?.update({ id: 'versioned-block', activeVersionId: latestVersion!.id, status: 'published' });
      editor.prompt.clearCache('versioned-block');

      // Verify updated content
      const v2 = await editor.prompt.preview([{ type: 'prompt_block_ref', id: 'versioned-block' }], {});
      expect(v2).toBe('Version 2 content');
    });

    it('should gracefully handle missing prompt blocks', async () => {
      // Reference a non-existent block — should be skipped
      const result = await editor.prompt.preview(
        [
          { type: 'text', content: 'Always be helpful.' },
          { type: 'prompt_block_ref', id: 'non-existent-block' },
        ],
        {},
      );

      expect(result).toBe('Always be helpful.');
    });

    it('should reflect prompt block updates in subsequent agent.generate() calls', async () => {
      // Create a prompt block with initial content
      await editor.prompt.create({
        id: 'updatable-block',
        name: 'Updatable Block',
        content: 'You specialize in {{topic || "general knowledge"}}.',
      });
      await editor.prompt.update({ id: 'updatable-block', status: 'published' });

      // Create an agent that references this block
      const agentsStore = await storage.getStore('agents');
      const created = await agentsStore?.create({
        agent: {
          id: 'updatable-agent',
          name: 'Updatable Agent',
          instructions: [
            { type: 'prompt_block_ref', id: 'updatable-block' },
            { type: 'text', content: 'Be concise.' },
          ],
          model: { provider: 'mock', name: 'mock-model' },
        },
      });

      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'updatable-agent',
          activeVersionId: created.versionId as string,
        });
      }

      // Get the agent once — we'll reuse the same instance to prove
      // prompt block content is resolved at runtime, not at agent creation time
      const agent = await editor.agent.getById('updatable-agent');
      const ctx = new RequestContext([['topic', 'astronomy']]);

      // First generate — should reflect v1 content
      const result1 = await agent!.generate('Tell me something.', { requestContext: ctx });
      expect(result1.text).toContain('You specialize in astronomy.');
      expect(result1.text).toContain('Be concise.');

      // Config changes require createVersion + update(activeVersionId)
      const promptStore = await storage.getStore('promptBlocks');
      await promptStore?.createVersion({
        id: randomUUID(),
        blockId: 'updatable-block',
        versionNumber: 2,
        name: 'Updatable Block',
        content: 'You are an expert in {{topic || "general knowledge"}}. Always cite sources.',
        changedFields: ['content'],
      });
      const latestVersion = await promptStore?.getLatestVersion('updatable-block');
      await promptStore?.update({ id: 'updatable-block', activeVersionId: latestVersion!.id, status: 'published' });
      editor.prompt.clearCache('updatable-block');

      // Second generate with the SAME agent instance — should reflect v2 content
      // because prompt blocks are resolved from storage at runtime
      const result2 = await agent!.generate('Tell me something.', { requestContext: ctx });
      expect(result2.text).toContain('You are an expert in astronomy. Always cite sources.');
      expect(result2.text).toContain('Be concise.');
      // Verify old content is gone
      expect(result2.text).not.toContain('You specialize in');
    });

    it('should silently skip a deleted prompt block during agent.generate()', async () => {
      // Create two prompt blocks
      await editor.prompt.create({
        id: 'keep-block',
        name: 'Keep Block',
        content: 'You are a helpful assistant.',
      });
      await editor.prompt.update({ id: 'keep-block', status: 'published' });

      await editor.prompt.create({
        id: 'delete-me-block',
        name: 'Delete Me Block',
        content: 'You also handle scheduling tasks.',
      });
      await editor.prompt.update({ id: 'delete-me-block', status: 'published' });

      // Create an agent referencing both blocks
      const agentsStore = await storage.getStore('agents');
      const created = await agentsStore?.create({
        agent: {
          id: 'deletion-test-agent',
          name: 'Deletion Test Agent',
          instructions: [
            { type: 'prompt_block_ref', id: 'keep-block' },
            { type: 'prompt_block_ref', id: 'delete-me-block' },
          ],
          model: { provider: 'mock', name: 'mock-model' },
        },
      });

      if (created && 'versionId' in created) {
        await agentsStore?.update({
          id: 'deletion-test-agent',
          activeVersionId: created.versionId as string,
        });
      }

      // Get the agent once — we'll reuse the same instance
      const agent = await editor.agent.getById('deletion-test-agent');

      // First generate — both blocks should be present
      const result1 = await agent!.generate('Hello');
      expect(result1.text).toContain('You are a helpful assistant.');
      expect(result1.text).toContain('You also handle scheduling tasks.');

      // Delete one of the blocks — no cache clearing needed
      await editor.prompt.delete('delete-me-block');

      // Second generate with the SAME agent instance — deleted block should be silently skipped
      // because prompt blocks are resolved from storage at runtime
      const result2 = await agent!.generate('Hello');
      expect(result2.text).toContain('You are a helpful assistant.');
      expect(result2.text).not.toContain('scheduling tasks');
    });

    it('should handle prompt block CRUD lifecycle', async () => {
      // Create
      const block = await editor.prompt.create({
        id: 'lifecycle-block',
        name: 'Lifecycle Block',
        content: 'Initial content',
        authorId: 'author-1',
        metadata: { category: 'test' },
      });
      expect(block.id).toBe('lifecycle-block');
      expect(block.authorId).toBe('author-1');

      // Read
      const retrieved = await editor.prompt.getById('lifecycle-block');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Lifecycle Block');
      expect(retrieved!.content).toBe('Initial content');

      // Update — config changes require createVersion + update(activeVersionId)
      const promptStore = await storage.getStore('promptBlocks');
      await promptStore?.createVersion({
        id: randomUUID(),
        blockId: 'lifecycle-block',
        versionNumber: 2,
        name: 'Updated Block',
        content: 'Updated content',
        changedFields: ['name', 'content'],
      });
      const latestVersion = await promptStore?.getLatestVersion('lifecycle-block');
      await promptStore?.update({ id: 'lifecycle-block', activeVersionId: latestVersion!.id, status: 'published' });
      editor.prompt.clearCache('lifecycle-block');

      const updated = await editor.prompt.getById('lifecycle-block');
      expect(updated!.content).toBe('Updated content');
      expect(updated!.name).toBe('Updated Block');

      // List
      const list = await editor.prompt.list();
      expect(list.promptBlocks.length).toBeGreaterThanOrEqual(1);
      expect(list.promptBlocks.some(b => b.id === 'lifecycle-block')).toBe(true);

      // List resolved
      const listResolved = await editor.prompt.listResolved();
      expect(listResolved.promptBlocks.length).toBeGreaterThanOrEqual(1);
      const resolvedBlock = listResolved.promptBlocks.find(b => b.id === 'lifecycle-block');
      expect(resolvedBlock).toBeDefined();
      expect(resolvedBlock!.content).toBe('Updated content');

      // Delete
      await editor.prompt.delete('lifecycle-block');
      const deleted = await editor.prompt.getById('lifecycle-block');
      expect(deleted).toBeNull();
    });
  });
});
