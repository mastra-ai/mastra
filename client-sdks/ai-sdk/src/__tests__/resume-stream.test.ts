import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { toAISdkStream } from '../convert-streams';

async function collectChunks(stream: ReadableStream) {
  const chunks: any[] = [];

  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }

  return chunks;
}

describe('resumeStream + toAISdkStream', () => {
  it('handles resumed nested sub-agent streams that continue with tool-result chunks', async () => {
    const suspendingTool = createTool({
      id: 'suspendingTool',
      description: 'Suspends until resume data is provided',
      inputSchema: z.object({
        query: z.string(),
      }),
      suspendSchema: z.object({
        message: z.string(),
      }),
      resumeSchema: z.object({
        extraInfo: z.string(),
      }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: `Need more info for: ${input.query}` });
        }

        return { answer: `${input.query}: ${context.agent.resumeData.extraInfo}` };
      },
    });

    let subAgentCallCount = 0;
    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => {
        subAgentCallCount++;

        if (subAgentCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'sub-1', modelId: 'sub-model', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'sub-tool-call-1',
                toolName: 'suspendingTool',
                input: '{"query":"supervisor test query"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 4, totalTokens: 9 },
              },
            ]),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sub-2', modelId: 'sub-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'sub-text-1' },
            { type: 'text-delta', id: 'sub-text-1', delta: 'Task completed.' },
            { type: 'text-end', id: 'sub-text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 4, outputTokens: 4, totalTokens: 8 },
            },
          ]),
        };
      },
    });

    const subAgent = new Agent({
      id: 'suspending-sub-agent',
      name: 'Suspending Sub Agent',
      description: 'An agent that gathers information using a suspending tool.',
      instructions: 'You gather information using the suspending tool.',
      model: subAgentModel,
      tools: { suspendingTool },
    });

    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supervisorCallCount++;

        if (supervisorCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'sup-1', modelId: 'sup-model', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'supervisor-call-1',
                toolName: 'agent-suspendingSubAgent',
                input: '{"prompt":"gather information"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-2', modelId: 'sup-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'sup-text-1' },
            { type: 'text-delta', id: 'sup-text-1', delta: 'Done' },
            { type: 'text-end', id: 'sup-text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 6, outputTokens: 3, totalTokens: 9 },
            },
          ]),
        };
      },
    });

    const supervisorAgent = new Agent({
      id: 'suspension-supervisor',
      name: 'Suspension Supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: supervisorModel,
      agents: { suspendingSubAgent: subAgent },
    });

    const mastra = new Mastra({
      agents: { suspensionSupervisor: supervisorAgent },
      storage: new InMemoryStore(),
      logger: false,
    });

    const registeredSupervisor = mastra.getAgent('suspensionSupervisor');
    const initialStream = await registeredSupervisor.stream('Gather some info', {
      maxSteps: 5,
      modelSettings: { maxRetries: 0 },
    });

    let suspended = false;

    for await (const chunk of initialStream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspended = true;
      }
    }

    expect(suspended).toBe(true);

    const resumedStream = await registeredSupervisor.resumeStream(
      { extraInfo: 'the answer is 42' },
      {
        runId: initialStream.runId,
        maxSteps: 5,
        modelSettings: { maxRetries: 0 },
      },
    );

    const [rawResumeStream, aiInputStream] = resumedStream.fullStream.tee();
    const rawChunks = await collectChunks(rawResumeStream);
    const aiChunks = await collectChunks(toAISdkStream(aiInputStream as any, { from: 'agent' }));

    expect(rawChunks[0]?.type).toBe('tool-output');
    expect(rawChunks[0]?.payload?.output?.type).toBe('tool-result');

    const nestedAgentChunks = aiChunks.filter(chunk => chunk.type === 'data-tool-agent');
    expect(nestedAgentChunks.length).toBeGreaterThan(0);
    expect(nestedAgentChunks[0]?.data.toolResults).toHaveLength(1);

    const finalText = aiChunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.delta ?? chunk.text ?? '')
      .join('');
    expect(finalText).toContain('Done');
  });
});
