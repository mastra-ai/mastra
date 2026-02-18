import { openai } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraError } from '../error';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
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

    await expect(orchestratorAgent.network([{ role: 'user', content: prompt }])).rejects.toThrow();
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

describe.skip('Agent - network - autoResumeSuspendedTools', () => {
  const memory = new MockMemory();
  const storage = new InMemoryStore();

  afterEach(async () => {
    const workflowsStore = await storage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  // Tool with suspend/resume for suspension tests
  const suspendingTool = createTool({
    id: 'suspendingTool',
    description: 'A tool that collects user information. Use this when the user wants to provide information.',
    inputSchema: z.object({ initialQuery: z.string().describe('The initial query from user') }),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: z.object({ userResponse: z.string() }),
    execute: async (input, context) => {
      if (!context?.agent?.resumeData) {
        return await context?.agent?.suspend({ message: 'Please provide additional information' });
      }
      return { result: `Received: ${input.initialQuery} and ${context.agent.resumeData.userResponse}` };
    },
  });

  it('should resume suspended direct network tool with autoResumeSuspendedTools: true', async () => {
    const networkAgent = new Agent({
      id: 'suspend-network-agent',
      name: 'Suspend Network Agent',
      instructions: 'You help users provide information. Use the suspending-tool when asked to collect info.',
      model: openai('gpt-4o-mini'),
      tools: { suspendingTool },
      memory,
      defaultNetworkOptions: {
        autoResumeSuspendedTools: true,
      },
    });

    // Register agent with Mastra for storage access
    const mastra = new Mastra({
      agents: { networkAgent },
      storage,
      logger: false,
    });

    const registeredAgent = mastra.getAgent('networkAgent');

    const anStream = await registeredAgent.network('Collect information with initial query "starting data"', {
      memory: {
        thread: 'test-thread-suspend-direct',
        resource: 'test-resource-suspend-direct',
      },
    });

    let suspensionReceived = false;
    let suspendPayload: any = null;

    const allChunks: any[] = [];
    for await (const chunk of anStream) {
      allChunks.push(chunk);
      if (chunk.type === 'tool-execution-suspended') {
        suspensionReceived = true;
        suspendPayload = chunk.payload?.suspendPayload;
      }
    }

    expect(allChunks[allChunks.length - 1].type).toBe('tool-execution-suspended');
    expect(suspensionReceived).toBe(true);
    expect(suspendPayload).toBeDefined();
    expect(suspendPayload?.message).toBe('Please provide additional information');

    // Resume with message
    const resumeStream = await registeredAgent.network('my additional info', {
      memory: {
        thread: 'test-thread-suspend-direct',
        resource: 'test-resource-suspend-direct',
      },
    });

    let toolResult: any = null;
    const resumeChunks: any[] = [];
    for await (const chunk of resumeStream) {
      resumeChunks.push(chunk);
      if (chunk.type === 'tool-execution-end') {
        toolResult = chunk.payload?.result;
      }
    }

    expect(resumeChunks[0].type).toBe('tool-execution-start');
    expect(resumeChunks[resumeChunks.length - 1].type).toBe('network-execution-event-finish');
    expect(toolResult).toBeDefined();
    expect(toolResult?.result).toContain('my additional info');
  }, 120e3);

  it('should resume suspended nested agent tool with autoResumeSuspendedTools: true', async () => {
    const subAgent = new Agent({
      id: 'sub-agent-suspend',
      name: 'Sub Agent Suspend',
      description: 'An agent that collects information using the suspending tool',
      instructions: 'You collect information. Always use the suspending-tool when asked to collect info.',
      model: openai('gpt-4o-mini'),
      tools: { suspendingTool },
    });

    const networkAgent = new Agent({
      id: 'network-agent-suspend-nested',
      name: 'Network Agent Suspend',
      instructions: 'You delegate information collection to the sub-agent-suspend agent.',
      model: openai('gpt-4o-mini'),
      agents: { subAgent },
      memory,
      defaultNetworkOptions: {
        autoResumeSuspendedTools: true,
      },
    });

    // Register agents with Mastra for storage access
    const mastra = new Mastra({
      agents: { networkAgent, subAgent },
      storage,
      logger: false,
    });

    const registeredAgent = mastra.getAgent('networkAgent');

    const anStream = await registeredAgent.network('Collect information with query "nested suspend test"', {
      memory: {
        thread: 'test-thread-suspend-nested',
        resource: 'test-resource-suspend-nested',
      },
    });

    let suspensionReceived = false;
    let suspendPayload: any = null;

    const allChunks: any[] = [];
    for await (const chunk of anStream) {
      allChunks.push(chunk);
      if (chunk.type === 'agent-execution-suspended') {
        suspensionReceived = true;
        suspendPayload = chunk.payload?.suspendPayload;
      }
    }

    expect(allChunks[allChunks.length - 1].type).toBe('agent-execution-suspended');
    expect(suspensionReceived).toBe(true);
    expect(suspendPayload).toBeDefined();
    expect(suspendPayload?.message).toBe('Please provide additional information');

    // Resume with message
    const resumeStream = await registeredAgent.network('nested resume data', {
      memory: {
        thread: 'test-thread-suspend-nested',
        resource: 'test-resource-suspend-nested',
      },
    });

    const resumeChunks: any[] = [];
    let agentExecutionEnded = false;
    for await (const chunk of resumeStream) {
      resumeChunks.push(chunk);
      if (chunk.type === 'agent-execution-event-tool-result') {
        if (chunk.payload.type === 'tool-result') {
          expect((chunk.payload.payload?.result as any)?.result).toContain('nested resume data');
        } else {
          throw new Error(`Unexpected chunk type: ${chunk.type}`);
        }
      }
      if (chunk.type === 'agent-execution-end') {
        agentExecutionEnded = true;
      }
    }

    expect(resumeChunks[0].type).toBe('agent-execution-start');
    expect(resumeChunks[resumeChunks.length - 1].type).toBe('network-execution-event-finish');
    expect(agentExecutionEnded).toBe(true);
  }, 120e3);

  it('should resume suspended workflow with autoResumeSuspendedTools: true', async () => {
    const suspendingStep = createStep({
      id: 'suspending-step',
      description: 'A step that suspends and waits for user input',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData, suspend, resumeData }) => {
        if (!resumeData) {
          return await suspend({ message: 'Please provide user input for workflow' });
        }
        return { result: `Workflow received: ${inputData.query} and ${resumeData.userInput}` };
      },
    });

    const suspendingWorkflow = createWorkflow({
      id: 'suspending-workflow',
      description: 'A workflow that collects user input. Use when asked to run a workflow that needs user input.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .then(suspendingStep)
      .commit();

    const networkAgent = new Agent({
      id: 'network-agent-workflow-suspend',
      name: 'Network Agent Workflow',
      instructions: 'You help run workflows. Use the suspending-workflow when asked to run a workflow.',
      model: openai('gpt-4o-mini'),
      workflows: { suspendingWorkflow },
      memory,
      defaultNetworkOptions: {
        autoResumeSuspendedTools: true,
      },
    });

    // Register agent with Mastra for storage access
    const mastra = new Mastra({
      agents: { networkAgent },
      storage,
      logger: false,
    });

    const registeredAgent = mastra.getAgent('networkAgent');

    const anStream = await registeredAgent.network('Run the workflow with query "workflow test"', {
      memory: {
        thread: 'test-thread-workflow-suspend',
        resource: 'test-resource-workflow-suspend',
      },
    });

    let suspensionReceived = false;
    let suspendPayload: any = null;

    const allChunks: any[] = [];
    for await (const chunk of anStream) {
      allChunks.push(chunk);
      if (chunk.type === 'workflow-execution-suspended') {
        suspensionReceived = true;
        suspendPayload = chunk.payload?.suspendPayload;
      }
    }

    expect(allChunks[allChunks.length - 1].type).toBe('workflow-execution-suspended');
    expect(suspensionReceived).toBe(true);
    expect(suspendPayload).toBeDefined();
    expect(suspendPayload?.message).toBe('Please provide user input for workflow');

    // Resume with message
    const resumeStream = await registeredAgent.network('workflow resume input', {
      memory: {
        thread: 'test-thread-workflow-suspend',
        resource: 'test-resource-workflow-suspend',
      },
    });

    const resumeChunks: any[] = [];
    let workflowResult: any = null;
    for await (const chunk of resumeStream) {
      resumeChunks.push(chunk);
      if (chunk.type === 'workflow-execution-end') {
        workflowResult = chunk.payload?.result;
      }
    }

    expect(resumeChunks[0].type).toBe('workflow-execution-start');
    expect(resumeChunks[resumeChunks.length - 1].type).toBe('network-execution-event-finish');
    expect(workflowResult).toBeDefined();
    expect(workflowResult?.result?.result).toContain('workflow resume input');
  }, 120e3);
}, 120e3);
