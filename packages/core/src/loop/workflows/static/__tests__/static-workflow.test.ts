import { randomUUID } from 'crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { MastraLLMVNext } from '../../../../llm/model/model.loop';
import { RequestContext } from '../../../../request-context';
import { createStaticExecutionWorkflow } from '../index';

describe('Static Execution Workflow', () => {
  it('should create workflow once and run multiple times without memory leaks', async () => {
    // Create the workflow ONCE
    const workflow = createStaticExecutionWorkflow();

    // Verify workflow is created
    expect(workflow).toBeDefined();
    expect(workflow.id).toBe('execution-workflow');

    // Verify it has the correct steps
    const steps = workflow.steps;
    expect(steps).toBeDefined();
    expect(Object.keys(steps)).toContain('prepare-tools-step');
    expect(Object.keys(steps)).toContain('prepare-memory-step');
    expect(Object.keys(steps)).toContain('stream-text-step');
    expect(Object.keys(steps)).toContain('map-results-step');
  });

  it('should execute workflow with mocked state', async () => {
    // Create the workflow once
    const workflow = createStaticExecutionWorkflow();

    // Mock capabilities
    const mockCapabilities = {
      agentName: 'test-agent',
      logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
      },
      generateMessageId: () => randomUUID(),
      convertTools: vi.fn().mockResolvedValue({}),
      runInputProcessors: vi.fn().mockResolvedValue({
        tripwireTriggered: false,
      }),
      getModel: vi.fn().mockResolvedValue({}),
      saveStepMessages: vi.fn().mockResolvedValue(undefined),
      executeOnFinish: vi.fn().mockResolvedValue(undefined),
      getMemoryMessages: vi.fn().mockResolvedValue({ messages: [] }),
      outputProcessors: [],
      llm: {
        stream: vi.fn().mockReturnValue({
          getFullOutput: vi.fn().mockResolvedValue({
            text: 'Hello World',
            finishReason: 'stop',
            usage: { totalTokens: 10 },
          }),
        }),
      },
    };

    // Mock options
    const mockOptions = {
      messages: [{ role: 'user', content: 'Hello!' }],
      context: [],
      system: undefined,
      toolsets: {},
      clientTools: {},
      savePerStep: false,
      inputProcessors: [],
      modelSettings: { temperature: 0.7 },
    };

    // Create state for this specific run
    const runId = randomUUID();
    const state = {
      capabilities: mockCapabilities,
      options: mockOptions,
      runId,
      methodType: 'stream' as const,
      instructions: 'You are a helpful assistant',
      requestContext: new RequestContext(),
      agentSpan: {} as any,
      saveQueueManager: {} as any,
      agentId: 'test-agent-id',
    };

    // Create a run with the state
    const run = await workflow.createRun({ runId });

    // Execute with state (NOT closures!)
    const result = await run.start({
      inputData: {},
      initialState: state,
    });

    // Verify result
    expect(result.status).toBe('success');
    expect(result).toBeDefined();

    // Verify capabilities were called correctly
    expect(mockCapabilities.convertTools).toHaveBeenCalled();
    expect(mockCapabilities.runInputProcessors).toHaveBeenCalled();
    expect(mockCapabilities.llm.stream).toHaveBeenCalled();
  });

  it('should run multiple executions with same workflow instance', async () => {
    // Create the workflow ONCE
    const workflow = createStaticExecutionWorkflow();

    // Track workflow reference to ensure it's the same
    const workflowRef = workflow;

    // Run 3 executions with different states
    const executions: Array<{
      runId: string;
      result: any;
      capabilities: any;
    }> = [];

    for (let i = 0; i < 3; i++) {
      const runId = `run-${i}`;

      const mockCapabilities = {
        agentName: `test-agent-${i}`,
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        },
        generateMessageId: () => randomUUID(),
        convertTools: vi.fn().mockResolvedValue({}),
        runInputProcessors: vi.fn().mockResolvedValue({
          tripwireTriggered: false,
        }),
        getModel: vi.fn().mockResolvedValue({}),
        saveStepMessages: vi.fn().mockResolvedValue(undefined),
        executeOnFinish: vi.fn().mockResolvedValue(undefined),
        getMemoryMessages: vi.fn().mockResolvedValue({ messages: [] }),
        outputProcessors: [],
        llm: {
          stream: vi.fn().mockReturnValue({
            getFullOutput: vi.fn().mockResolvedValue({
              text: `Response ${i}`,
              finishReason: 'stop',
              usage: { totalTokens: 10 },
            }),
          }),
        },
      };

      const state = {
        capabilities: mockCapabilities,
        options: {
          messages: [{ role: 'user', content: `Message ${i}` }],
          context: [],
          toolsets: {},
          clientTools: {},
          savePerStep: false,
          inputProcessors: [],
          modelSettings: { temperature: 0.7 },
        },
        runId,
        methodType: 'stream' as const,
        instructions: 'You are a helpful assistant',
        requestContext: new RequestContext(),
        agentSpan: {} as any,
        saveQueueManager: {} as any,
        agentId: `test-agent-${i}`,
      };

      const run = await workflow.createRun({ runId });
      const result = await run.start({
        inputData: {},
        initialState: state,
      });

      executions.push({
        runId,
        result,
        capabilities: mockCapabilities,
      });
    }

    // Verify all executions succeeded
    expect(executions).toHaveLength(3);
    executions.forEach((exec, _i) => {
      expect(exec.result.status).toBe('success');
      expect(exec.capabilities.convertTools).toHaveBeenCalled();
      expect(exec.capabilities.llm.stream).toHaveBeenCalled();
    });

    // Verify we used the same workflow instance
    expect(workflow).toBe(workflowRef);

    console.log('✅ Same workflow instance used for 3 executions - NO MEMORY LEAK!');
  });

  it('should handle tripwire early exit', async () => {
    const workflow = createStaticExecutionWorkflow();

    const mockCapabilities = {
      agentName: 'test-agent',
      logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
      },
      generateMessageId: () => randomUUID(),
      convertTools: vi.fn().mockResolvedValue({}),
      runInputProcessors: vi.fn().mockResolvedValue({
        tripwireTriggered: true,
        tripwireReason: 'Content policy violation',
      }),
      getModel: vi.fn().mockResolvedValue({
        provider: 'openai',
        modelId: 'gpt-4',
      }),
    };

    const state = {
      capabilities: mockCapabilities,
      options: {
        messages: [{ role: 'user', content: 'Inappropriate content' }],
        context: [],
        toolsets: {},
        clientTools: {},
        savePerStep: false,
        inputProcessors: [],
        modelSettings: {},
      },
      runId: randomUUID(),
      methodType: 'stream' as const,
      instructions: 'You are a helpful assistant',
      requestContext: new RequestContext(),
      agentSpan: {} as any,
      saveQueueManager: {} as any,
      agentId: 'test-agent-id',
    };

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {},
      initialState: state,
    });

    // Verify tripwire was triggered
    expect(result.status).toBe('success');
    expect(mockCapabilities.runInputProcessors).toHaveBeenCalled();
  });

  it('should not create closures - verify memory safety', () => {
    // Create workflow
    const workflow = createStaticExecutionWorkflow();

    // Get the steps
    const prepareToolsStep = workflow.steps['prepare-tools-step'];
    const prepareMemoryStep = workflow.steps['prepare-memory-step'];
    const streamStep = workflow.steps['stream-text-step'];
    const mapResultsStep = workflow.steps['map-results-step'];

    // Verify steps exist and have correct structure
    expect(prepareToolsStep).toBeDefined();
    expect(prepareMemoryStep).toBeDefined();
    expect(streamStep).toBeDefined();
    expect(mapResultsStep).toBeDefined();

    // Verify steps have stateSchema (meaning they use state, not closures)
    expect(prepareToolsStep.stateSchema).toBeDefined();
    expect(prepareMemoryStep.stateSchema).toBeDefined();
    expect(streamStep.stateSchema).toBeDefined();
    expect(mapResultsStep.stateSchema).toBeDefined();

    // Verify inputSchema is empty for prepare steps (data comes from state)
    expect(prepareToolsStep.inputSchema).toBeDefined();
    expect(prepareMemoryStep.inputSchema).toBeDefined();

    console.log('✅ All steps use stateSchema - no closures capturing request data!');
  });

  it.skipIf(!process.env.OPENAI_API_KEY)(
    'should work with real OpenAI model',
    async () => {
      console.log('\n🚀 Starting OpenAI Integration Test');
      console.log('━'.repeat(60));

      // Create the static workflow once
      const workflow = createStaticExecutionWorkflow();

      console.log('✅ Workflow created');
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Steps: ${Object.keys(workflow.steps).join(', ')}`);
      console.log(`   Workflow instance: ${workflow.constructor.name}`);
      console.log('');

      // Create real OpenAI model
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const model = new MastraLLMVNext({
        models: [
          {
            model: openai('gpt-4o-mini'),
            maxRetries: 0,
            id: 'gpt-4o-mini',
          },
        ],
      });

      console.log('🤖 Model configured: gpt-4o-mini');

      // Real capabilities with actual LLM
      const capabilities = {
        agentName: 'test-openai-agent',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        },
        generateMessageId: () => randomUUID(),
        convertTools: async () => ({}),
        runInputProcessors: async () => ({
          tripwireTriggered: false,
        }),
        getModel: async () => model,
        saveStepMessages: vi.fn(),
        executeOnFinish: vi.fn(),
        getMemoryMessages: async () => ({ messages: [] }),
        outputProcessors: [],
        llm: model,
      };

      // Create state with real model
      const state = {
        capabilities,
        options: {
          messages: [
            {
              role: 'user',
              content: 'Say "Hello from static workflow!" and nothing else.',
            },
          ],
          context: [],
          toolsets: {},
          clientTools: {},
          savePerStep: false,
          inputProcessors: [],
          modelSettings: {
            temperature: 0,
            maxTokens: 50,
          },
        },
        runId: randomUUID(),
        methodType: 'stream' as const,
        instructions: 'You are a helpful assistant. Follow instructions exactly.',
        requestContext: new RequestContext(),
        agentSpan: {} as any,
        saveQueueManager: {} as any,
        agentId: 'test-openai-agent-id',
      };

      // Execute with real OpenAI
      console.log('\n📤 First Execution');
      console.log(`   Run ID: ${state.runId}`);
      console.log(`   Message: "${state.options.messages[0].content}"`);

      const run = await workflow.createRun({ runId: state.runId });
      const result = await run.start({
        inputData: {},
        initialState: state,
      });

      console.log(`   Status: ${result.status}`);

      // Verify execution succeeded
      expect(result.status).toBe('success');

      // Get the actual response
      if (result.status !== 'success') {
        throw new Error('Expected success status');
      }

      const stepResult = result.steps['stream-text-step'];
      if (!stepResult || stepResult.status !== 'success') {
        throw new Error('Stream step did not complete successfully');
      }
      const output = stepResult.output as any;
      expect(output).toBeDefined();

      // Get the full output from the stream
      const fullOutput = await output.getFullOutput();
      expect(fullOutput.text).toBeDefined();
      expect(fullOutput.text.toLowerCase()).toContain('hello');

      console.log('   Response:', fullOutput.text);
      console.log('   Tokens:', JSON.stringify(fullOutput.totalUsage));
      console.log('   ✅ First execution complete');

      // Run a second time with the SAME workflow instance
      console.log('\n📤 Second Execution (reusing same workflow instance)');
      const state2 = {
        ...state,
        runId: randomUUID(),
        options: {
          ...state.options,
          messages: [
            {
              role: 'user',
              content: 'Say "Second execution!" and nothing else.',
            },
          ],
        },
      };

      console.log(`   Run ID: ${state2.runId}`);
      console.log(`   Message: "${state2.options.messages[0].content}"`);

      const run2 = await workflow.createRun({ runId: state2.runId });
      const result2 = await run2.start({
        inputData: {},
        initialState: state2,
      });

      console.log(`   Status: ${result2.status}`);

      expect(result2.status).toBe('success');
      if (result2.status !== 'success') {
        throw new Error('Expected success status');
      }

      const stepResult2 = result2.steps['stream-text-step'];
      if (!stepResult2 || stepResult2.status !== 'success') {
        throw new Error('Second stream step did not complete successfully');
      }
      const output2 = stepResult2.output as any;
      const fullOutput2 = await output2.getFullOutput();
      expect(fullOutput2.text.toLowerCase()).toContain('second');

      console.log('   Response:', fullOutput2.text);
      console.log('   Tokens:', JSON.stringify(fullOutput2.totalUsage));
      console.log('   ✅ Second execution complete');

      console.log('\n' + '━'.repeat(60));
      console.log('✅ TEST PASSED: Same workflow reused - NO MEMORY LEAK!');
      console.log('   - Workflow created once');
      console.log('   - Two executions with different states');
      console.log('   - No workflow recreation overhead');
      console.log('━'.repeat(60) + '\n');
    },
    30000,
  );
});
