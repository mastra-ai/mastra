import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { createStep, createWorkflow } from '../../../workflows';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('durable registry tool execution context', () => {
  it.each([
    { advertised: true, key: 'runWorkflow' },
    { advertised: false, key: 'runWorkflow' },
    { advertised: false, key: 'publishedWorkflowTool' },
  ])('runs a registered workflow across turns ($advertised, $key)', async ({ advertised, key }) => {
    let modelCalls = 0;
    const identities: unknown[] = [];
    const workflowInputs: string[] = [];
    const schema = z.object({ value: z.string() });
    const workflow = createWorkflow({ id: 'tool-workflow', inputSchema: schema, outputSchema: schema })
      .then(
        createStep({
          id: 'record-input',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => {
            workflowInputs.push(inputData.value);
            return { value: `${inputData.value}:completed` };
          },
        }),
      )
      .commit();
    const tool = createTool({
      id: 'runWorkflow',
      description: 'Run the registered workflow.',
      inputSchema: schema,
      execute: async (input, context) => {
        identities.push({
          agentId: context.agent?.agentId,
          threadId: context.agent?.threadId,
          resourceId: context.agent?.resourceId,
          toolCallId: context.agent?.toolCallId,
          tenant: context.requestContext?.get('tenant'),
        });
        const run = await context.mastra!.getWorkflowById('tool-workflow').createRun();
        const result = await run.start({ inputData: input });
        if (result.status !== 'success') throw new Error(`Workflow ${result.status}`);
        return result.result;
      },
    });
    const model = new MockLanguageModelV2({
      doStream: async ({ tools }) => {
        modelCalls++;
        expect(tools?.some(tool => tool.name === 'runWorkflow')).toBe(advertised);
        const calling = modelCalls % 2 === 1;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(calling
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function',
                    toolCallId: `call-${modelCalls}`,
                    toolName: 'runWorkflow',
                    input: JSON.stringify({ value: `request-${modelCalls}` }),
                  },
                ]
              : [
                  { type: 'text-start' as const, id: 'text' },
                  { type: 'text-delta' as const, id: 'text', delta: 'Done.' },
                  { type: 'text-end' as const, id: 'text' },
                ]),
            {
              type: 'finish',
              finishReason: calling ? 'tool-calls' : 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const unrelatedTool = createTool({
      id: 'unrelated',
      description: 'An unrelated advertised tool.',
      inputSchema: z.object({}),
      execute: async () => 'unused',
    });
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        instructions: 'Run the workflow.',
        model: model as LanguageModelV2,
        memory: new MockMemory(),
        tools: advertised ? { runWorkflow: tool } : { unrelated: unrelatedTool },
      }),
      pubsub,
    });
    const mastra = new Mastra({
      agents: { agent: agent as any },
      tools: { [key]: tool },
      workflows: { workflow },
      storage: new InMemoryStore(),
      pubsub,
      logger: false,
    });
    try {
      for (const turn of [1, 3]) {
        const response = await agent.stream('Run the workflow.', {
          memory: { thread: 'workflow-thread', resource: 'workflow-user' },
          requestContext: new RequestContext([['tenant', 'workflow-tenant']]),
          maxSteps: 2,
        });
        const chunks: any[] = [];
        for await (const chunk of response.fullStream) chunks.push(chunk);
        expect(chunks.filter(chunk => chunk.type === 'tool-error')).toEqual([]);
        expect(chunks.find(chunk => chunk.type === 'tool-result')?.payload.result).toEqual({
          value: `request-${turn}:completed`,
        });
      }
      expect(workflowInputs).toEqual(['request-1', 'request-3']);
      expect(identities).toEqual(
        [1, 3].map(turn => ({
          agentId: 'workflow-agent',
          threadId: 'workflow-thread',
          resourceId: 'workflow-user',
          toolCallId: `call-${turn}`,
          tenant: 'workflow-tenant',
        })),
      );
    } finally {
      await mastra.shutdown();
      await pubsub.close();
    }
  });
});
