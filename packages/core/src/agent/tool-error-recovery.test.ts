import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../tools';
import { Agent } from './index';

/**
 * Repro for https://github.com/mastra-ai/mastra/issues/21054
 *
 * When a tool's execute() throws (e.g. ENOENT / EACCES filesystem errors), the
 * error is wrapped in a TOOL_EXECUTION_FAILED MastraError. The agentic loop must
 * feed that error back to the model as a tool error and continue, so the model
 * can see the failure and self-correct — not halt the run.
 */

function createThrowingTool(error: Error) {
  return createTool({
    id: 'readFile',
    description: 'Read a file from disk',
    inputSchema: z.object({ path: z.string() }),
    execute: async () => {
      throw error;
    },
  });
}

const enoentError = Object.assign(new Error("ENOENT: no such file or directory, open '/tmp/missing.txt'"), {
  code: 'ENOENT',
  path: '/tmp/missing.txt',
});

describe('agent loop recovery after tool execution failure (#21054)', () => {
  it('generate: continues the loop and lets the model see the tool error', async () => {
    const prompts: any[] = [];
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }: any) => {
        callCount++;
        prompts.push(prompt);
        if (callCount === 1) {
          return {
            content: [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile', input: '{"path": "/tmp/missing.txt"}' },
            ],
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            warnings: [],
          };
        }
        return {
          content: [{ type: 'text' as const, text: 'The file does not exist.' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'tool-error-recovery',
      name: 'Tool Error Recovery',
      model,
      instructions: 'You are a helpful assistant.',
      tools: { readFile: createThrowingTool(enoentError) },
    });

    const result = await agent.generate('Read /tmp/missing.txt', { maxSteps: 3 });

    // The loop must continue after the tool failure: the model is called again
    // and produces the final text answer.
    expect(callCount).toBe(2);
    expect(result.text).toBe('The file does not exist.');
    expect(result.steps.length).toBeGreaterThan(1);

    // The second model call must include the tool error so the model can recover.
    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toMatch(/ENOENT/);
  });

  it('stream: emits a tool-error chunk and continues the loop', async () => {
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'r-1', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'readFile',
                input: '{"path": "/tmp/missing.txt"}',
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
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r-2', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't-1' },
            { type: 'text-delta', id: 't-1', delta: 'The file does not exist.' },
            { type: 'text-end', id: 't-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tool-error-recovery-stream',
      name: 'Tool Error Recovery Stream',
      model,
      instructions: 'You are a helpful assistant.',
      tools: { readFile: createThrowingTool(enoentError) },
    });

    const output = await agent.stream('Read /tmp/missing.txt', { maxSteps: 3 });

    const toolErrorChunks: any[] = [];
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'tool-error') {
        toolErrorChunks.push(chunk);
      }
    }

    expect(toolErrorChunks.length).toBeGreaterThan(0);
    expect(String(toolErrorChunks[0].payload.error?.message ?? toolErrorChunks[0].payload.error)).toMatch(/ENOENT/);

    // Loop continued: model called a second time and final text produced.
    expect(callCount).toBe(2);
    expect(await output.text).toBe('The file does not exist.');
  });
});
