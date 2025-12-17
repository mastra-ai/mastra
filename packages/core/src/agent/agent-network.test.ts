import { openai } from '@ai-sdk/openai-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from '../error';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { Agent } from './index';

/**
 * Validates that iteration counter works correctly in agent network loops.
 * Prevents regression of issue #9314 where iteration counter was stuck at 0.
 * Also prevents skipping the first iteration (should start at 0, not 1).
 */
async function checkIterations(anStream: AsyncIterable<any>) {
  const iterations: number[] = [];
  for await (const chunk of anStream) {
    if (chunk.type === 'routing-agent-end') {
      const iteration = (chunk.payload as any)?.iteration;
      iterations.push(iteration);
    }
  }

  // Check that iterations start at 0 and increment correctly
  for (let i = 0; i < iterations.length; i++) {
    expect(iterations[i], `Iteration ${i} should be ${i}, but got ${iterations[i]}. `).toBe(i);
  }

  // Explicitly verify first iteration is 0 (not 1)
  expect(iterations[0], 'First iteration must start at 0, not 1').toBe(0);
}

describe.skip('Agent - network', () => {
  const memory = new MockMemory();

  const agent1 = new Agent({
    id: 'agent1',
    name: 'Research Agent',
    instructions:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    description:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    model: openai('gpt-4o'),
  });

  const agent2 = new Agent({
    id: 'agent2',
    name: 'Text Synthesis Agent',
    description:
      'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles.',
    instructions:
      'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles. [IMPORTANT] Make sure to mention information that has been highlighted as relevant in message history.',
    model: openai('gpt-4o'),
  });

  const agentStep1 = createStep({
    id: 'agent-step',
    description: 'This step is used to do research and text synthesis.',
    inputSchema: z.object({
      city: z.string().describe('The city to research'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await agent1.generate(inputData.city, {
        structuredOutput: {
          schema: z.object({
            text: z.string(),
          }),
        },
      });

      return { text: resp.object.text };
    },
  });

  const agentStep2 = createStep({
    id: 'agent-step',
    description: 'This step is used to do research and text synthesis.',
    inputSchema: z.object({
      text: z.string().describe('The city to research'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await agent2.generate(inputData.text, {
        structuredOutput: {
          schema: z.object({
            text: z.string(),
          }),
        },
      });

      return { text: resp.object.text };
    },
  });

  const workflow1 = createWorkflow({
    id: 'workflow1',
    description: 'This workflow is perfect for researching a specific city.',
    steps: [],
    inputSchema: z.object({
      city: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    options: { validateInputs: false },
  })
    .then(agentStep1)
    .then(agentStep2)
    .commit();

  const agentStep1WithStream = createStep(agent1);

  const agentStep2WithStream = createStep(agent2);

  const workflow1WithAgentStream = createWorkflow({
    id: 'workflow1',
    description: 'This workflow is perfect for researching a specific topic.',
    steps: [],
    inputSchema: z.object({
      researchTopic: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
  })
    .map(async ({ inputData }) => {
      return {
        prompt: inputData.researchTopic,
      };
    })
    .then(agentStep1WithStream)
    .map(async ({ inputData }) => {
      return {
        prompt: inputData.text,
      };
    })
    .then(agentStep2WithStream)
    .commit();

  const tool = createTool({
    id: 'tool1',
    description: 'This tool will tell you about "cool stuff"',
    inputSchema: z.object({
      howCool: z.string().describe('How cool is the stuff?'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async (inputData, context) => {
      await context?.writer?.write({
        type: 'my-custom-tool-payload',
        payload: {
          context: inputData,
        },
      });

      return { text: `This is a test tool. How cool is the stuff? ${inputData.howCool}` };
    },
  });

  const network = new Agent({
    id: 'test-network',
    name: 'Test Network',
    instructions:
      'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material.',
    model: openai('gpt-4o-mini'),
    agents: {
      agent1,
      agent2,
    },
    workflows: {
      workflow1,
    },
    tools: {
      tool,
    },
    memory,
  });

  const networkWithWflowAgentStream = new Agent({
    id: 'test-network-with-workflow-agent-stream',
    name: 'Test Network',
    instructions:
      'You can research anything. You can also synthesize research material. You can also write a full report based on the researched material.',
    model: openai('gpt-4o-mini'),
    agents: {
      agent1,
      agent2,
    },
    workflows: {
      workflow1WithAgentStream,
    },
    tools: {
      tool,
    },
    memory,
  });

  const requestContext = new RequestContext();

  it('LOOP - execute a single tool', async () => {
    const anStream = await network.network('Execute tool1', {
      requestContext,
    });

    await checkIterations(anStream);
  });

  it('LOOP - execute a single workflow', async () => {
    const anStream = await network.network('Execute workflow1 on Paris', {
      requestContext,
    });

    await checkIterations(anStream);
  });

  it('LOOP - execute a single agent', async () => {
    const anStream = await network.network('Research dolphins', {
      requestContext,
    });

    await checkIterations(anStream);
  });

  it('LOOP - execute a single agent then workflow', async () => {
    const anStream = await network.network(
      'Research dolphins then execute workflow1 based on the location where dolphins live',
      {
        requestContext,
        maxSteps: 3,
      },
    );

    await checkIterations(anStream);
  });

  it('LOOP - should not trigger WorkflowRunOutput deprecation warning when executing workflows', async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: string) => {
      warnings.push(message);
    };

    try {
      const anStream = await network.network('Execute workflow1 on Paris', {
        requestContext,
      });

      // Consume the stream
      for await (const _chunk of anStream) {
        // Just iterate through
      }

      // Verify no deprecation warnings about WorkflowRunOutput[Symbol.asyncIterator]
      const deprecationWarnings = warnings.filter(
        w => w.includes('WorkflowRunOutput[Symbol.asyncIterator]') && w.includes('deprecated'),
      );

      expect(deprecationWarnings).toHaveLength(0);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('LOOP - should track usage data from workflow with agent stream agent.network()', async () => {
    const anStream = await networkWithWflowAgentStream.network('Research dolphins', {
      requestContext,
    });

    let networkUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };

    // Consume the stream to trigger usage collection
    for await (const _chunk of anStream) {
      if (
        _chunk.type === 'routing-agent-end' ||
        _chunk.type === 'agent-execution-end' ||
        _chunk.type === 'workflow-execution-end'
      ) {
        if (_chunk.payload?.usage) {
          networkUsage.inputTokens += parseInt(_chunk.payload.usage?.inputTokens?.toString() ?? '0', 10);
          networkUsage.outputTokens += parseInt(_chunk.payload.usage?.outputTokens?.toString() ?? '0', 10);
          networkUsage.totalTokens += parseInt(_chunk.payload.usage?.totalTokens?.toString() ?? '0', 10);
          networkUsage.reasoningTokens += parseInt(_chunk.payload.usage?.reasoningTokens?.toString() ?? '0', 10);
          networkUsage.cachedInputTokens += parseInt(_chunk.payload.usage?.cachedInputTokens?.toString() ?? '0', 10);
        }
      }
    }

    // Check that usage data is available
    const usage = await anStream.usage;
    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBe(networkUsage.inputTokens);
    expect(usage.outputTokens).toBe(networkUsage.outputTokens);
    expect(usage.totalTokens).toBe(networkUsage.totalTokens);
    expect(usage.reasoningTokens).toBe(networkUsage.reasoningTokens);
    expect(usage.cachedInputTokens).toBe(networkUsage.cachedInputTokens);
  });

  it('LOOP - should track usage data from agent in agent.network()', async () => {
    const anStream = await networkWithWflowAgentStream.network('Research dolphins using agent1', {
      requestContext,
    });

    let networkUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };

    let finishUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };

    // Consume the stream to trigger usage collection
    for await (const _chunk of anStream) {
      if (
        _chunk.type === 'routing-agent-end' ||
        _chunk.type === 'agent-execution-end' ||
        _chunk.type === 'workflow-execution-end'
      ) {
        if (_chunk.payload?.usage) {
          networkUsage.inputTokens += parseInt(_chunk.payload.usage?.inputTokens?.toString() ?? '0', 10);
          networkUsage.outputTokens += parseInt(_chunk.payload.usage?.outputTokens?.toString() ?? '0', 10);
          networkUsage.totalTokens += parseInt(_chunk.payload.usage?.totalTokens?.toString() ?? '0', 10);
          networkUsage.reasoningTokens += parseInt(_chunk.payload.usage?.reasoningTokens?.toString() ?? '0', 10);
          networkUsage.cachedInputTokens += parseInt(_chunk.payload.usage?.cachedInputTokens?.toString() ?? '0', 10);
        }
      }

      if (_chunk.type === 'network-execution-event-finish') {
        finishUsage = _chunk.payload.usage as any;
      }
    }

    // Check that usage data is available
    const usage = await anStream.usage;
    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBe(networkUsage.inputTokens);
    expect(usage.outputTokens).toBe(networkUsage.outputTokens);
    expect(usage.totalTokens).toBe(networkUsage.totalTokens);
    expect(usage.reasoningTokens).toBe(networkUsage.reasoningTokens);
    expect(usage.cachedInputTokens).toBe(networkUsage.cachedInputTokens);
    expect(usage.inputTokens).toBe(finishUsage.inputTokens);
    expect(usage.outputTokens).toBe(finishUsage.outputTokens);
    expect(usage.totalTokens).toBe(finishUsage.totalTokens);
    expect(usage.reasoningTokens).toBe(finishUsage.reasoningTokens);
    expect(usage.cachedInputTokens).toBe(finishUsage.cachedInputTokens);
  });

  it('Should throw if memory is not configured', async () => {
    const calculatorAgent = new Agent({
      id: 'calculator-agent',
      name: 'Calculator Agent',
      instructions: `You are a calculator agent. You can perform basic arithmetic operations such as addition, subtraction, multiplication, and division.
    When you receive a request, you should respond with the result of the calculation.`,
      model: openai('gpt-4o-mini'),
    });

    const orchestratorAgentConfig = {
      systemInstruction: `
      You are an orchestrator agent.

      You have access to one agent: Calculator Agent.
    - Calculator Agent can perform basic arithmetic operations such as addition, subtraction, multiplication, and division.
    `,
    };

    const orchestratorAgent = new Agent({
      id: 'orchestrator-agent',
      name: 'Orchestrator Agent',
      instructions: orchestratorAgentConfig.systemInstruction,
      model: openai('gpt-4o-mini'),
      agents: {
        calculatorAgent,
      },
    });

    const prompt = `Hi!`; // <- this triggers an infinite loop

    expect(orchestratorAgent.network([{ role: 'user', content: prompt }])).rejects.toThrow();
  });

  it('Should generate title for network thread when generateTitle is enabled', async () => {
    let titleGenerated = false;
    let generatedTitle = '';

    // Create a custom memory with generateTitle enabled
    const memoryWithTitleGen = new MockMemory();
    memoryWithTitleGen.getMergedThreadConfig = () => {
      return {
        generateTitle: true,
      };
    };

    // Override createThread to capture the title
    const originalCreateThread = memoryWithTitleGen.createThread.bind(memoryWithTitleGen);
    memoryWithTitleGen.createThread = async (params: any) => {
      const result = await originalCreateThread(params);
      if (params.title && !params.title.startsWith('New Thread')) {
        titleGenerated = true;
        generatedTitle = params.title;
      }
      return result;
    };

    const networkWithTitle = new Agent({
      id: 'test-network-with-title',
      name: 'Test Network With Title',
      instructions:
        'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material.',
      model: openai('gpt-4o-mini'),
      agents: {
        agent1,
        agent2,
      },
      workflows: {
        workflow1,
      },
      tools: {
        tool,
      },
      memory: memoryWithTitleGen,
    });

    const anStream = await networkWithTitle.network('Research dolphins', {
      requestContext,
    });

    await checkIterations(anStream);

    // Wait a bit for async title generation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerated).toBe(true);
    expect(generatedTitle).toBeTruthy();
    expect(generatedTitle.length).toBeGreaterThan(0);
  });

  it('Should generate title for network thread when generateTitle is enabled via network options', async () => {
    let titleGenerated = false;
    let generatedTitle = '';

    // Create a custom memory with generateTitle enabled
    const memoryWithTitleGen = new MockMemory();

    // Override createThread to capture the title
    const originalCreateThread = memoryWithTitleGen.createThread.bind(memoryWithTitleGen);
    memoryWithTitleGen.createThread = async (params: any) => {
      const result = await originalCreateThread(params);
      if (params.title && !params.title.startsWith('New Thread')) {
        titleGenerated = true;
        generatedTitle = params.title;
      }
      return result;
    };

    const networkWithTitle = new Agent({
      id: 'test-network-with-title-in-options',
      name: 'Test Network With Title In Options',
      instructions:
        'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material.',
      model: openai('gpt-4o-mini'),
      agents: {
        agent1,
        agent2,
      },
      workflows: {
        workflow1,
      },
      tools: {
        tool,
      },
      memory: memoryWithTitleGen,
    });

    const anStream = await networkWithTitle.network('Research dolphins', {
      requestContext,
      memory: {
        thread: 'test-network-with-title',
        resource: 'test-network-with-title',
        options: {
          generateTitle: true,
        },
      },
    });

    await checkIterations(anStream);

    // Wait a bit for async title generation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerated).toBe(true);
    expect(generatedTitle).toBeTruthy();
    expect(generatedTitle.length).toBeGreaterThan(0);
  });

  it('Should not generate title when generateTitle is false', async () => {
    let titleGenerationAttempted = false;

    const memoryWithoutTitleGen = new MockMemory();
    memoryWithoutTitleGen.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: false,
        },
      };
    };

    // Override createThread to check if title generation was attempted
    const originalCreateThread = memoryWithoutTitleGen.createThread.bind(memoryWithoutTitleGen);
    memoryWithoutTitleGen.createThread = async (params: any) => {
      if (params.title && !params.title.startsWith('New Thread')) {
        titleGenerationAttempted = true;
      }
      return await originalCreateThread(params);
    };

    const networkNoTitle = new Agent({
      id: 'test-network-no-title',
      name: 'Test Network No Title',
      instructions: 'You can research topics.',
      model: openai('gpt-4o-mini'),
      agents: {
        agent1,
      },
      memory: memoryWithoutTitleGen,
    });

    const anStream = await networkNoTitle.network('Research dolphins', {
      requestContext,
    });

    await checkIterations(anStream);

    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerationAttempted).toBe(false);
  });

  it('Should not generate title when generateTitle:false is passed in netwwork options', async () => {
    let titleGenerationAttempted = false;

    const memoryWithoutTitleGen = new MockMemory();

    // Override createThread to check if title generation was attempted
    const originalCreateThread = memoryWithoutTitleGen.createThread.bind(memoryWithoutTitleGen);
    memoryWithoutTitleGen.createThread = async (params: any) => {
      if (params.title && !params.title.startsWith('New Thread')) {
        titleGenerationAttempted = true;
      }
      return await originalCreateThread(params);
    };

    const networkNoTitle = new Agent({
      id: 'test-network-no-title',
      name: 'Test Network No Title',
      instructions: 'You can research topics.',
      model: openai('gpt-4o-mini'),
      agents: {
        agent1,
      },
      memory: memoryWithoutTitleGen,
    });

    const anStream = await networkNoTitle.network('Research dolphins', {
      requestContext,
      memory: {
        thread: 'test-network-no-title',
        resource: 'test-network-no-title',
        options: {
          threads: {
            generateTitle: false,
          },
        },
      },
    });

    await checkIterations(anStream);

    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerationAttempted).toBe(false);
  });
}, 120e3);

describe('Agent - network - updateWorkingMemory', () => {
  it('Should forward memory context (threadId, resourceId) to sub-agents when using same memory template', async () => {
    // Create a shared memory instance with working memory enabled
    // This is the scenario from issue #9873 where sub-agents share the same memory template
    const sharedMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `
      # Information Profile
      - Title:
      - Some facts:
        - Fact 1:
        - Fact 2:
        - Fact 3:
      - Summary:
      `,
    });

    // Create sub-agents with the shared memory and working memory enabled
    // These agents will need threadId/resourceId to use updateWorkingMemory tool
    const subAgent1 = new Agent({
      id: 'sub-agent-1',
      name: 'Sub Agent 1',
      instructions:
        'You are a helpful assistant. When the user provides information, remember it using your memory tools.',
      model: openai('gpt-4o-mini'),
      memory: sharedMemory,
      defaultOptions: {
        toolChoice: 'required',
      },
    });

    const subAgent2 = new Agent({
      id: 'sub-agent-2',
      name: 'Sub Agent 2',
      instructions:
        'You are a helpful assistant. When the user provides information, remember it using your memory tools.',
      model: openai('gpt-4o-mini'),
      memory: sharedMemory,
      defaultOptions: {
        toolChoice: 'required',
      },
    });

    // Create network agent with the same shared memory
    const networkWithSharedMemory = new Agent({
      id: 'network-with-shared-memory',
      name: 'Network With Shared Memory',
      instructions:
        'You can delegate tasks to sub-agents. Sub Agent 1 handles research tasks. Sub Agent 2 handles writing tasks.',
      model: openai('gpt-4o-mini'),
      agents: {
        subAgent1,
        subAgent2,
      },
      memory: sharedMemory,
    });

    const threadId = 'test-thread-shared-memory';
    const resourceId = 'test-resource-shared-memory';

    const anStream = await networkWithSharedMemory.network('Research dolphins and write a summary', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume the stream and track sub-agent executions
    for await (const chunk of anStream) {
      if (chunk.type === 'agent-execution-event-tool-result') {
        const payload = chunk.payload as any;
        const toolName = payload.payload?.toolName;
        const result = payload.payload?.result;
        if (toolName === 'updateWorkingMemory' && result instanceof MastraError) {
          const toolResultMessage = result?.message;
          if (toolResultMessage.includes('Thread ID') || toolResultMessage.includes('resourceId')) {
            expect.fail(toolResultMessage + ' should not be thrown');
          }
        }
      }
    }

    // Verify the stream completed (usage should be available)
    const usage = await anStream.usage;
    expect(usage).toBeDefined();

    // Verify that the thread was created/accessed in memory
    // This confirms that memory operations worked correctly
    const thread = await sharedMemory.getThreadById({ threadId });
    expect(thread).toBeDefined();
    expect(thread?.id).toBe(threadId);
    expect(thread?.resourceId).toBe(resourceId);
  });
}, 120e3);

describe('Agent - network - finalResult token efficiency', () => {
  it('should NOT store redundant toolCalls in finalResult when messages already contain tool call data', async () => {
    // The finalResult object was storing toolCalls separately even though
    // the messages array already contains all tool call information.
    // This caused massive token waste when the routing agent reads from memory.

    const savedMessages: any[] = [];

    // Create a mock memory that captures saved messages
    const memory = new MockMemory();
    const originalSaveMessages = memory.saveMessages.bind(memory);
    memory.saveMessages = async (params: any) => {
      savedMessages.push(...params.messages);
      return originalSaveMessages(params);
    };

    // Create a sub-agent with a tool that will be called
    const testTool = createTool({
      id: 'test-tool',
      description: 'A test tool that returns some data',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        return { result: `Processed: ${query}` };
      },
    });

    // Create mock responses for the routing agent
    // First call: select the sub-agent
    const routingSelectAgent = JSON.stringify({
      primitiveId: 'subAgent',
      primitiveType: 'agent',
      prompt: 'Use the test-tool to process "hello world"',
      selectionReason: 'Sub-agent can use the test tool',
    });

    // Second call: completion check - mark as complete
    const completionResponse = JSON.stringify({
      isComplete: true,
      finalResult: 'Task completed successfully',
      completionReason: 'The sub-agent processed the request',
    });

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        const text = callCount === 1 ? routingSelectAgent : completionResponse;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text }],
          warnings: [],
        };
      },
      doStream: async () => {
        callCount++;
        const text = callCount === 1 ? routingSelectAgent : completionResponse;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-delta', id: 'id-0', delta: text },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        };
      },
    });

    // Sub-agent mock that will "use" the tool
    // Simulate a response that includes a tool call
    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        content: [
          {
            type: 'tool-call',
            toolCallId: 'test-tool-call-1',
            toolName: 'test-tool',
            args: { query: 'hello world' },
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'test-tool-call-1',
            toolName: 'test-tool',
            args: { query: 'hello world' },
          },
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      }),
    });

    const subAgent = new Agent({
      id: 'subAgent',
      name: 'Sub Agent',
      description: 'A sub-agent that can use tools',
      instructions: 'Use the test-tool when asked to process something.',
      model: subAgentMockModel,
      tools: { 'test-tool': testTool },
    });

    const networkAgent = new Agent({
      id: 'network-agent',
      name: 'Network Agent',
      instructions: 'Delegate tasks to sub-agents.',
      model: mockModel,
      agents: { subAgent },
      memory,
    });

    const anStream = await networkAgent.network('Process hello world using the test tool', {
      memory: {
        thread: 'test-thread-11059',
        resource: 'test-resource-11059',
      },
    });

    // Consume the stream
    for await (const _chunk of anStream) {
      // Process stream
    }

    // Find the message saved after agent execution (contains finalResult)
    const networkMessages = savedMessages.filter(msg => {
      if (msg.content?.parts?.[0]?.text) {
        try {
          const parsed = JSON.parse(msg.content.parts[0].text);
          return parsed.isNetwork === true && parsed.primitiveType === 'agent';
        } catch {
          return false;
        }
      }
      return false;
    });

    expect(networkMessages.length).toBeGreaterThan(0);

    // Parse the finalResult from the saved message
    const networkMessage = networkMessages[0];
    const parsedContent = JSON.parse(networkMessage.content.parts[0].text);

    // finalResult should only have: { text, messages }
    // It should NOT have: toolCalls (redundant with messages)
    expect(parsedContent.finalResult).not.toHaveProperty('toolCalls');

    // But the tool call data should still be present in the messages array
    const messagesInFinalResult = parsedContent.finalResult.messages || [];
    const toolCallMessages = messagesInFinalResult.filter((m: any) => m.type === 'tool-call');
    const toolResultMessages = messagesInFinalResult.filter((m: any) => m.type === 'tool-result');

    // Verify tool calls are preserved in messages
    expect(toolCallMessages.length).toBeGreaterThan(0);
    expect(toolResultMessages.length).toBeGreaterThan(0);
  });
});

describe('Agent - network - tool context validation', () => {
  it('should pass toolCallId, threadId, and resourceId in context.agent when network executes a tool', async () => {
    const mockExecute = vi.fn(async (_inputData, _context) => {
      return { result: 'context captured' };
    });

    const tool = createTool({
      id: 'context-check-tool',
      description: 'Tool to validate context.agent properties from network',
      inputSchema: z.object({
        message: z.string(),
      }),
      execute: mockExecute,
    });

    // Mock model returns routing agent selection schema
    // The network's routing agent uses structuredOutput expecting: { primitiveId, primitiveType, prompt, selectionReason }
    const routingResponse = JSON.stringify({
      primitiveId: 'tool',
      primitiveType: 'tool',
      prompt: JSON.stringify({ message: 'validate context' }),
      selectionReason: 'Test context propagation through network',
    });

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: routingResponse }],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-delta', id: 'id-0', delta: routingResponse },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    });

    const memory = new MockMemory();

    const agent = new Agent({
      id: 'context-network-agent',
      name: 'Context Test Network',
      instructions: 'Use the context-check-tool to validate context properties.',
      model: mockModel,
      tools: { tool },
      memory,
    });

    const threadId = 'context-test-thread';
    const resourceId = 'context-test-resource';

    const anStream = await agent.network('Validate context by using the context-check-tool', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume the stream to trigger tool execution through network
    for await (const _chunk of anStream) {
      // Stream events are processed
    }

    // Verify the tool was called with context containing toolCallId, threadId, and resourceId
    expect(mockExecute).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'validate context' }),
      expect.objectContaining({
        agent: expect.objectContaining({
          toolCallId: expect.any(String),
          threadId,
          resourceId,
        }),
      }),
    );
  });
});
