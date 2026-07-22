import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';

/**
 * Repro for a production crash in the durable Agent's OUTBOUND prompt build.
 *
 * When the durable Agent builds the next model request from thread history via
 * `messageList.get.all.aiV6.llmPrompt()` (or the underlying `aiV5.llmPrompt()`),
 * a stored, well-formed tool-result is converted into a `tool` ModelMessage whose
 * tool-result part has `output: undefined`. Handed to `@openrouter/ai-sdk-provider`,
 * whose `getToolResultContent(i){ return i.output.type === 'text' ? ... }` reads
 * `.type` on undefined, this throws
 * "Cannot read properties of undefined (reading 'type')" and permanently poisons
 * the thread.
 *
 * Root cause: `llmPrompt()`'s `storedModelOutputs` override (message-list.ts,
 * ~L571-605) keys off `'modelOutput' in providerMetadata.mastra` (key presence)
 * and then unconditionally overwrites the already-correct converted `output` with
 * `mastra.modelOutput`. When that stored value is `undefined`/`null`, it clobbers
 * the valid output. The `.prompt()`/`.model()` accessors do NOT have this override,
 * which is why the crash only shows up on the durable `llmPrompt` path.
 *
 * The tool-invocation part below carries `providerMetadata.mastra.modelOutput`
 * present-but-undefined (JSON serialization drops the key, so a plain DB dump
 * shows `mastra: {}` — the value only survives in-memory within a run, which is
 * exactly when the durable workflow builds the next request).
 */
const TOOL_CALL_ID = 'call_a6vmNvERgEs7d6sv720R3G2z';
const TOOL_NAME = 'mastra_workspace_read_file';
const ARGS = {
  path: '/output/openbayes-usage/whoami.json',
  offset: 1,
  limit: 220,
  showLineNumbers: true,
  encoding: 'utf-8',
} as const;
const RESULT =
  '/output/openbayes-usage/whoami.json (lines 1-220 of 335, 6930 bytes)\n' +
  '     1→{\n     2→  "me": { ... a long string ... }';

const REASONING_DETAILS = [
  {
    type: 'reasoning.encrypted',
    data: 'ZW5jcnlwdGVkLWJhc2U2NC1ibG9iLXBsYWNlaG9sZGVy',
    id: 'rs_02ae0000',
    format: 'openai-responses-v1',
    index: 0,
  },
];

function poisonedMessage() {
  return {
    id: 'mem-assistant-poisoned',
    role: 'assistant' as const,
    content: {
      format: 2 as const,
      parts: [
        {
          type: 'reasoning' as const,
          reasoning: '',
          details: [],
          providerMetadata: { openrouter: { reasoning_details: REASONING_DETAILS } },
        },
        {
          type: 'tool-invocation' as const,
          toolInvocation: {
            state: 'result' as const,
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            args: { ...ARGS },
            result: RESULT,
          },
          providerMetadata: {
            openrouter: { reasoning_details: REASONING_DETAILS },
            // The load-bearing poison: the key exists but the value is undefined.
            mastra: { modelOutput: undefined },
          },
        },
      ],
      metadata: {
        modelId: 'openai/gpt-5.4',
        provider: 'openrouter',
        mastra: { responseBoundary: true },
      },
    },
    createdAt: new Date('2024-01-01T00:00:01Z'),
    threadId: 'thread-1',
  };
}

describe('outbound tool-result conversion — output must survive (prod crash repro)', () => {
  it('preserves output and input on the durable v6 llmPrompt tool ModelMessage', async () => {
    const list = new MessageList();

    list.add(
      {
        id: 'mem-user1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Read whoami.json' }] },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    list.add(poisonedMessage(), 'memory');

    // New user turn — the durable Agent builds the next model request from history.
    list.add({ role: 'user', content: 'What is my username?' }, 'input');

    // This is the exact accessor the durable Agent uses for v6/"responses" providers
    // (packages/core/src/agent/durable/workflows/steps/llm-execution.ts).
    const prompt = await list.get.all.aiV6.llmPrompt();

    const toolMsg = prompt.find(m => m.role === 'tool');
    expect(toolMsg, 'expected a role:"tool" model message').toBeDefined();
    expect(Array.isArray(toolMsg!.content)).toBe(true);

    const toolResult = (toolMsg!.content as any[]).find(p => p.type === 'tool-result' && p.toolCallId === TOOL_CALL_ID);
    expect(toolResult, 'expected a tool-result part for the toolCallId').toBeDefined();

    // The crash driver: output must NOT be undefined. `@openrouter/ai-sdk-provider`
    // reads `output.type`, so an undefined output throws and aborts the stream.
    expect(toolResult.output, 'tool-result.output must be defined').toBeDefined();

    // And it must carry the actual tool result text.
    expect(JSON.stringify(toolResult.output)).toContain('whoami.json');

    // input must equal the original args (not {}).
    expect(toolResult.input).toEqual(ARGS);
  });
});
