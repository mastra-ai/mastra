import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RESOURCE_TYPES } from '../loop/types';
import { RuntimeContext } from '../runtime-context';
import { MastraAgentNetworkStream } from '../stream/MastraAgentNetworkStream';
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
      const resp = await agent1.generateVNext(inputData.city, {
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
      const resp = await agent2.generateVNext(inputData.text, {
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
    model: openai('gpt-4o'),
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
    memory: memory as any,
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
  });

  it('PARALLEL WORKFLOW WITH AGENT - reproduce stream error', async () => {
    // Create a simple test agent with API key from env
    const testAgent = new Agent({
      id: 'test-parallel-agent',
      name: 'test-parallel-agent',
      instructions: 'You are a helpful assistant that responds with brief, concise answers. Answer in one sentence.',
      model: openai('gpt-4o'),
    });
    const runId = randomUUID();

    // Create main workflow with just a parallel step that invokes the agent
    const mainWorkflow = createWorkflow({
      id: 'test-parallel-workflow',
      inputSchema: z.object({
        task: z.string(),
      }),
      outputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        result: z.string(),
        isComplete: z.boolean().optional(),
        iteration: z.number(),
      }),
    })
      .parallel([
        createStep({
          id: 'agent-execution-step',
          inputSchema: z.object({
            task: z.string(),
          }),
          outputSchema: z.object({
            task: z.string(),
            resourceId: z.string(),
            resourceType: RESOURCE_TYPES,
            result: z.string(),
            isComplete: z.boolean().optional(),
            iteration: z.number(),
          }),
          execute: async ({ inputData, writer }) => {
            const runId = randomUUID();

            await writer.write({
              type: 'agent-execution-start',
              payload: {
                agentId: testAgent.id,
                args: inputData,
                runId,
              },
            });

            try {
              // This is where the stream error may occur
              const result = await testAgent.streamVNext(inputData.task, {
                runtimeContext,
                runId,
              });

              // Consume the stream
              for await (const chunk of result.fullStream) {
                await writer.write({
                  type: `agent-execution-event-${chunk.type}`,
                  payload: chunk,
                });
              }

              const text = await result.text;

              await writer.write({
                type: 'agent-execution-end',
                payload: {
                  task: inputData.task,
                  agentId: testAgent.id,
                  result: text,
                  isComplete: true,
                  iteration: 0,
                },
              });

              return {
                task: inputData.task,
                resourceId: testAgent.id,
                resourceType: 'agent' as const,
                result: text,
                isComplete: false,
                iteration: 0,
              };
            } catch (error) {
              // Re-throw to test error propagation
              throw error;
            }
          },
        }),
      ])
      .commit();

    // Create and execute the workflow run
    const run = await mainWorkflow.createRunAsync({
      runId,
    });

    // Wrap with MastraAgentNetworkStream similar to agent.network()
    const networkStream = new MastraAgentNetworkStream({
      run,
      createStream: () => {
        return run.streamVNext({
          inputData: {
            task: 'What is 2+2?',
          },
        });
      },
    });

    const chunks: any[] = [];

    // Consume the network stream
    for await (const chunk of networkStream) {
      chunks.push(chunk);
    }

    const status = await networkStream.status;

    // Expectations for successful execution
    expect(status).toBeDefined();
    expect(status).toBe('success');

    // Verify we received chunks
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBe(15); // Based on the actual output

    // Verify the sequence of events
    const eventTypes = chunks.map(c => c?.type).filter(Boolean);

    // First event should be agent-execution-start
    expect(eventTypes[0]).toBe('agent-execution-start');
    expect(chunks[0].payload.agentId).toBe('test-parallel-agent');

    // Should have agent stream events
    expect(eventTypes).toContain('agent-execution-event-start');
    expect(eventTypes).toContain('agent-execution-event-step-start');
    expect(eventTypes).toContain('agent-execution-event-text-start');
    expect(eventTypes).toContain('agent-execution-event-text-end');
    expect(eventTypes).toContain('agent-execution-event-step-finish');
    expect(eventTypes).toContain('agent-execution-event-finish');

    // Last event should be agent-execution-end
    expect(eventTypes[eventTypes.length - 1]).toBe('agent-execution-end');
    expect(chunks[chunks.length - 1].payload.result).toBe('2+2 equals 4.');

    // Count text-delta events (should have multiple for streaming)
    const textDeltaCount = eventTypes.filter(t => t === 'agent-execution-event-text-delta').length;
    expect(textDeltaCount).toBeGreaterThan(0);

    // Verify the text was assembled correctly
    const textDeltas = chunks
      .filter(c => c?.type === 'agent-execution-event-text-delta')
      .map(c => c.payload.payload.text)
      .join('');
    expect(textDeltas).toBe('2+2 equals 4.');

    // Verify complete event sequence
    // Check first 4 events
    expect(eventTypes.slice(0, 4)).toEqual([
      'agent-execution-start',
      'agent-execution-event-start',
      'agent-execution-event-step-start',
      'agent-execution-event-text-start',
    ]);

    // Check last 4 events
    expect(eventTypes.slice(-4)).toEqual([
      'agent-execution-event-text-end',
      'agent-execution-event-step-finish',
      'agent-execution-event-finish',
      'agent-execution-end',
    ]);

    // Verify middle events are all text-delta and we have at least 1
    const middleEvents = eventTypes.slice(4, -4);
    expect(middleEvents.length).toBeGreaterThanOrEqual(1);
    expect(middleEvents.every(type => type === 'agent-execution-event-text-delta')).toBe(true);
  });
}, 120e3);
