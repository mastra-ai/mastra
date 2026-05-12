import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

describe('same-tool parallel suspends', () => {
  const getSuspendedToolMetadata = async (memory: MockMemory) => {
    const { messages } = await memory.recall({ threadId: 'same-tool-thread' });
    const assistantMessage = [...messages].reverse().find(message => message.role === 'assistant');
    return assistantMessage?.content.metadata?.suspendedTools as Record<string, any>;
  };

  const expectWorkflowToolResume = (chunks: any[], toolCallId: string, status: string) => {
    expect(chunks.find(chunk => chunk.type === 'tool-error')).toBeUndefined();
    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-output',
          payload: expect.objectContaining({
            toolCallId,
            output: expect.objectContaining({
              type: 'workflow-step-result',
              payload: expect.objectContaining({
                output: { status },
              }),
            }),
          }),
        }),
      ]),
    );
  };

  it('resumes parallel suspensions for separate calls to the same workflow tool', async () => {
    const approve = createStep({
      id: 'approve',
      inputSchema: z.object({ recipient: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ recipient: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (resumeData?.approved) {
          return { status: `sent to ${inputData.recipient}` };
        }
        return suspend({ recipient: inputData.recipient });
      },
    });

    const sendEmail = createWorkflow({
      id: 'sendEmail',
      inputSchema: z.object({ recipient: z.string() }),
      outputSchema: z.object({ status: z.string() }),
    })
      .then(approve)
      .commit();

    let streamCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        streamCount++;
        if (streamCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'test-id', modelId: 'test-model', timestamp: new Date() },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-A',
                toolName: 'workflow-sendEmail',
                input: '{"inputData":{"recipient":"alice@example.com"}}',
              },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-B',
                toolName: 'workflow-sendEmail',
                input: '{"inputData":{"recipient":"bob@example.com"}}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ] as any),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'test-id', modelId: 'test-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'done' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const memory = new MockMemory();
    const agent = new Agent({
      id: 'same-tool-repro-agent',
      name: 'Same Tool Repro Agent',
      instructions: 'Use the sendEmail tool.',
      model,
      memory,
      workflows: { sendEmail },
    });

    new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const stream = await agent.stream('send email to two people', {
      memory: { thread: 'same-tool-thread', resource: 'same-tool-user' },
      maxSteps: 5,
    });

    const suspendedToolCallIds: string[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspendedToolCallIds.push((chunk.payload as any).toolCallId);
      }
    }

    expect(suspendedToolCallIds).toEqual(['call-A', 'call-B']);
    expect(Object.keys(await getSuspendedToolMetadata(memory)).sort()).toEqual(['call-A', 'call-B']);

    const firstResume = await agent.resumeStream({ approved: true }, { runId: stream.runId, toolCallId: 'call-A' });
    const firstResumeChunks = [];
    for await (const chunk of firstResume.fullStream) {
      firstResumeChunks.push(chunk);
    }

    expectWorkflowToolResume(firstResumeChunks, 'call-A', 'sent to alice@example.com');
    const metadataAfterFirstResume = await getSuspendedToolMetadata(memory);
    expect(metadataAfterFirstResume['call-A'].resumed).toBe(true);
    expect(metadataAfterFirstResume['call-B'].resumed).toBeUndefined();

    const secondResume = await agent.resumeStream({ approved: true }, { runId: stream.runId, toolCallId: 'call-B' });
    const secondResumeChunks = [];
    for await (const chunk of secondResume.fullStream) {
      secondResumeChunks.push(chunk);
    }

    expectWorkflowToolResume(secondResumeChunks, 'call-B', 'sent to bob@example.com');
    const metadataAfterSecondResume = await getSuspendedToolMetadata(memory);
    expect(metadataAfterSecondResume['call-A'].resumed).toBe(true);
    expect(metadataAfterSecondResume['call-B'].resumed).toBe(true);
  });
});
