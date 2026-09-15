/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/18956
 *
 * `Agent#generate`/`#stream` accept `MessageListInput`, whose `MessageInput`
 * union listed AI SDK v4/v5/v6 message types but not v7. Under
 * `exactOptionalPropertyTypes: true`, an AI SDK v7 `ModelMessage` is not
 * assignable to the v5 branch (v7 `providerOptions?: JSONValue | undefined`
 * vs v5 `providerOptions?: JSONValue`), so `agent.generate(v7Messages)` failed
 * to compile (TS2769) in userland. These tests run against packed artifacts
 * installed from the local registry — exactly what users consume — under
 * `exactOptionalPropertyTypes: true` (see tsconfig.exact-optional.json), the
 * strict flag that surfaces the bug.
 */
import { describe, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import type { ModelMessage, UIMessage } from 'ai-v7';

const agent = new Agent({
  id: 'v7-input-agent',
  name: 'v7 Input Agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-4o',
});

declare const modelMessages: ModelMessage[];
declare const uiMessages: UIMessage[];

describe('Agent message input accepts AI SDK v7 messages (#18956)', () => {
  it('accepts v7 ModelMessage[] in generate()', async () => {
    await agent.generate(modelMessages);
  });

  it('accepts v7 UIMessage[] in generate()', async () => {
    await agent.generate(uiMessages);
  });
});
