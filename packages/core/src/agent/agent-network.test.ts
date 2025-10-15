import { openai } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { MockMemory } from './test-utils';
import { Agent } from './index';

describe('Agent - network', () => {
  const memory = new MockMemory();

  const agent1 = new Agent({
    name: 'agent1',
    instructions:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    description:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    model: openai('gpt-4o'),
  });

  const agent2 = new Agent({
    name: 'agent2',
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
        output: z.object({
          text: z.string(),
        }),
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
        output: z.object({
          text: z.string(),
        }),
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
  })
    .then(agentStep1)
    .then(agentStep2)
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
    execute: async ({ context, ...rest }) => {
      await rest.writer?.write({
        type: 'my-custom-tool-payload',
        payload: {
          context,
        },
      });

      return { text: `This is a test tool. How cool is the stuff? ${context.howCool}` };
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

  const runtimeContext = new RuntimeContext();

  it('LOOP - execute a single tool', async () => {
    const anStream = await network.network('Execute tool1', {
      runtimeContext,
    });

    for await (const chunk of anStream) {
      console.log(chunk);
    }
  });

  it('LOOP - execute a single workflow', async () => {
    const anStream = await network.network('Execute workflow1 on Paris', {
      runtimeContext,
    });

    for await (const chunk of anStream) {
      console.log(chunk);
    }
  });

  it('LOOP - execute a single agent', async () => {
    const anStream = await network.network('Research dolphins', {
      runtimeContext,
    });

    for await (const chunk of anStream) {
      console.log(chunk);
    }
  });

  it('LOOP - execute a single agent then workflow', async () => {
    const anStream = await network.network(
      'Research dolphins then execute workflow1 based on the location where dolphins live',
      {
        runtimeContext,
        maxSteps: 3,
      },
    );

    for await (const chunk of anStream) {
      console.log(chunk);
    }

    console.log('SUH', anStream);
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

  it.only('Should generate title for network thread when generateTitle is enabled', async () => {
    let titleGenerated = false;
    let generatedTitle = '';

    // Create a custom memory with generateTitle enabled
    const memoryWithTitleGen = new MockMemory();
    memoryWithTitleGen.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: true,
        },
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
      runtimeContext,
    });

    // Consume the stream
    for await (const chunk of anStream) {
      // Just consume the chunks
    }

    // Wait a bit for async title generation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerated).toBe(true);
    expect(generatedTitle).toBeTruthy();
    expect(generatedTitle.length).toBeGreaterThan(0);
  });

  it('Should use custom model for title generation in network', async () => {
    let titleModelUsed = false;
    let networkModelUsed = false;

    // Create a custom model for title generation
    const titleModel = {
      ...openai('gpt-4o-mini'),
      doGenerate: async (params: any) => {
        titleModelUsed = true;
        return openai('gpt-4o-mini').doGenerate(params);
      },
    };

    const networkModel = {
      ...openai('gpt-4o-mini'),
      doGenerate: async (params: any) => {
        networkModelUsed = true;
        return openai('gpt-4o-mini').doGenerate(params);
      },
    };

    // Create memory with custom title generation model
    const memoryWithCustomModel = new MockMemory();
    memoryWithCustomModel.getMergedThreadConfig = () => {
      return {
        threads: {
          generateTitle: {
            model: titleModel,
          },
        },
      };
    };

    const networkWithCustomTitle = new Agent({
      id: 'test-network-custom-title',
      name: 'Test Network Custom Title',
      instructions: 'You can research topics.',
      model: networkModel,
      agents: {
        agent1,
      },
      memory: memoryWithCustomModel,
    });

    const anStream = await networkWithCustomTitle.network('Research dolphins', {
      runtimeContext,
    });

    // Consume the stream
    for await (const chunk of anStream) {
      // Just consume the chunks
    }

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleModelUsed).toBe(true);
    expect(networkModelUsed).toBe(true);
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
      runtimeContext,
    });

    // Consume the stream
    for await (const chunk of anStream) {
      // Just consume the chunks
    }

    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(titleGenerationAttempted).toBe(false);
  });
}, 120e3);
