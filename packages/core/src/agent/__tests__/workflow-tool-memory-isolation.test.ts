import { randomUUID } from 'node:crypto';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from '../../loop/test-utils/MastraLanguageModelV2Mock';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { createStep, createWorkflow } from '../../workflows/workflow';
import { Agent } from '../agent';

function createWorkflowCallingModel(toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
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
              toolCallType: 'function',
              toolName,
              input: JSON.stringify({ inputData: { prompt: 'sub-task' } }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

function createSimpleTextModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Sub-agent response' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      ]),
    }),
  });
}

describe('Workflow tool MastraMemory isolation', () => {
  it('should restore MastraMemory on requestContext after workflow tool execution', async () => {
    const parentThreadId = randomUUID();
    const subAgentThreadId = randomUUID();
    const resourceId = 'test-user';
    const mockMemory = new MockMemory();

    await mockMemory.createThread({ threadId: parentThreadId, resourceId });
    await mockMemory.createThread({ threadId: subAgentThreadId, resourceId });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a sub-agent.',
      model: createSimpleTextModel(),
      memory: mockMemory,
    });

    // This step runs a sub-agent with its OWN thread, which overwrites
    // MastraMemory on the shared requestContext.
    const subAgentStep = createStep({
      id: 'sub-agent-step',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ inputData, requestContext }) => {
        const stream = await subAgent.stream(inputData.prompt, {
          memory: { thread: subAgentThreadId, resource: resourceId },
          requestContext,
          maxSteps: 1,
        });
        await stream.consumeStream();
        return { text: await stream.text };
      },
    });

    const myWorkflow = createWorkflow({
      id: 'my-workflow',
      description: 'A workflow with a sub-agent',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(subAgentStep)
      .commit();

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent.',
      model: createWorkflowCallingModel('workflow-myWorkflow'),
      memory: mockMemory,
      workflows: { myWorkflow },
    });

    new Mastra({ agents: { parentAgent }, logger: false });

    const requestContext = new RequestContext();

    const stream = await parentAgent.stream('Do something', {
      memory: { thread: parentThreadId, resource: resourceId },
      requestContext,
      maxSteps: 5,
    });
    await stream.consumeStream();

    // After the workflow tool finishes, MastraMemory must point back
    // to the parent's thread — not the sub-agent's thread.
    const restoredMemory = requestContext.get('MastraMemory') as any;
    expect(restoredMemory).toBeDefined();
    expect(restoredMemory?.thread?.id).toBe(parentThreadId);
  });

  it('should restore MastraMemory even when workflow tool execution fails', async () => {
    const parentThreadId = randomUUID();
    const resourceId = 'test-user';
    const mockMemory = new MockMemory();

    await mockMemory.createThread({ threadId: parentThreadId, resourceId });

    const failingStep = createStep({
      id: 'failing-step',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ requestContext }) => {
        // Corrupt MastraMemory before failing, simulating a sub-agent
        // that partially ran and overwrote the context.
        requestContext?.set('MastraMemory', {
          thread: { id: 'corrupted-thread' },
          resourceId: 'corrupted-resource',
          memoryConfig: {},
        });
        throw new Error('Step failed intentionally');
      },
    });

    const myWorkflow = createWorkflow({
      id: 'my-workflow',
      description: 'A workflow that fails',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .then(failingStep)
      .commit();

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent.',
      model: createWorkflowCallingModel('workflow-myWorkflow'),
      memory: mockMemory,
      workflows: { myWorkflow },
    });

    new Mastra({ agents: { parentAgent }, logger: false });

    const requestContext = new RequestContext();

    const stream = await parentAgent.stream('Do something', {
      memory: { thread: parentThreadId, resource: resourceId },
      requestContext,
      maxSteps: 5,
    });
    await stream.consumeStream();

    // MastraMemory must be restored even after a failed workflow execution
    // that corrupted the requestContext.
    const restoredMemory = requestContext.get('MastraMemory') as any;
    expect(restoredMemory).toBeDefined();
    expect(restoredMemory?.thread?.id).toBe(parentThreadId);
  });
});
