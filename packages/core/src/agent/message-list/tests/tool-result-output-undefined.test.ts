import { describe, expect, it } from 'vitest';

import { MessageList } from '../index';

// Regression for a durable-Agent prompt-build crash.
//
// A tool's `toModelOutput` can return `undefined` (e.g. a text-only result). The
// durable llm-mapping step persists that as `mastra: { modelOutput: undefined }`
// (key present, value nullish). `llmPrompt()`'s stored-output override used to
// key off key-presence and clobber the correctly-converted tool-result `output`
// with `undefined`. Providers that read `output.type` (e.g.
// `@openrouter/ai-sdk-provider`) then throw `Cannot read properties of undefined
// (reading 'type')` and abort the request.
describe('MessageList llmPrompt tool-result output', () => {
  it('does not clobber the converted output when the stored modelOutput is nullish', async () => {
    const toolCallId = 'call_1';
    const result = 'whoami.json (17 lines)\n{ "id": "aisensiy" }';

    const list = new MessageList();
    list.add({ role: 'user', content: 'read whoami.json' }, 'input');
    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId,
                toolName: 'read_file',
                args: { path: 'whoami.json' },
                result,
              },
              // The poison: the key exists but its value is undefined.
              providerMetadata: { mastra: { modelOutput: undefined } },
            },
          ],
        },
      },
      'memory',
    );

    const prompt = await list.get.all.aiV6.llmPrompt();
    const toolResult = prompt
      .filter(m => m.role === 'tool')
      .flatMap(m => (Array.isArray(m.content) ? m.content : []))
      .find((p: any) => p.type === 'tool-result' && p.toolCallId === toolCallId) as any;

    expect(toolResult?.output, 'tool-result output must not be clobbered to undefined').toBeDefined();
    expect(JSON.stringify(toolResult.output)).toContain('whoami.json');
  });
});
