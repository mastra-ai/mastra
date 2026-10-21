import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { FactoryReplyReminderProcessor } from './reply-reminder-processor.js';
import { REPLY_TOOL_NAME } from './reply-tool.js';

const MINUTE = 60_000;
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A model that plays a fixed script of tool calls and records each prompt it was sent. */
function scriptedModel(script: Array<{ tool: string; input: Record<string, unknown> } | { text: string }>) {
  const prompts: string[] = [];
  let step = 0;
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'scripted',
    modelId: 'scripted',
    supportedUrls: {},
    async doGenerate(): Promise<never> {
      throw new Error('stream only');
    },
    async doStream(options: { prompt: Array<{ role: string; content: unknown }> }) {
      prompts.push(
        options.prompt
          .filter(message => message.role === 'system')
          .map(message => String(message.content))
          .join('\n'),
      );
      const next = script[step++] ?? { text: 'done' };
      const parts =
        'tool' in next
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: `call-${step}`, toolName: next.tool, input: JSON.stringify(next.input) },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: next.text },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
  return { model, prompts };
}

describe('reply reminder in a real agent run', () => {
  it('nudges a run that has been working silently, and stops once it posts', async () => {
    let now = 0;
    const work = createTool({
      id: 'work',
      description: 'Does six minutes of work.',
      inputSchema: z.object({}),
      execute: async () => {
        now += 6 * MINUTE;
        return { ok: true };
      },
    });
    const reply = createTool({
      id: REPLY_TOOL_NAME,
      description: 'Post in the thread.',
      inputSchema: z.object({ text: z.string() }),
      execute: async () => ({ posted: true }),
    });
    const { model, prompts } = scriptedModel([
      { tool: 'work', input: {} },
      { tool: REPLY_TOOL_NAME, input: { text: 'Still going.' } },
      { text: 'done' },
    ]);
    const agent = new Agent({
      id: 'reminder-agent',
      name: 'reminder-agent',
      instructions: 'You work.',
      model: model as never,
      tools: { work, [REPLY_TOOL_NAME]: reply },
      inputProcessors: [new FactoryReplyReminderProcessor({ now: () => now })],
    });

    const stream = await agent.stream('go', { maxSteps: 5 });
    await stream.consumeStream();

    expect(prompts).toHaveLength(3);
    expect(prompts[0]).not.toContain('since you last posted');
    // Six minutes of silent work later, the next step carries the reminder…
    expect(prompts[1]).toContain('It has been 6 minutes since you last posted in this thread.');
    // …and the step after the agent posted no longer does.
    expect(prompts[2]).not.toContain('since you last posted');
  });
});
