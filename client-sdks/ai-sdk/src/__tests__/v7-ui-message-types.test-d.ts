import type { Mastra } from '@mastra/core/mastra';
import { describe, expectTypeOf, it } from 'vitest';

import { handleChatStream } from '../chat-route';
import type { V7UIMessage } from '../public-types';

// Mirrors `JSONValue` from `@ai-sdk/provider@>=4.0.16`, which `ai@>=7.0.103` uses for `providerMetadata`.
type ReadonlyJSONValue = null | string | number | boolean | ReadonlyJSONObject | readonly ReadonlyJSONValue[];
type ReadonlyJSONObject = Readonly<{ [key: string]: ReadonlyJSONValue | undefined }>;

type AppUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{
    type: 'text';
    text: string;
    providerMetadata?: Record<string, ReadonlyJSONObject>;
  }>;
};

describe('v7 UIMessage compatibility', () => {
  it('accepts messages with readonly providerMetadata', () => {
    expectTypeOf<AppUIMessage>().toExtend<V7UIMessage>();
  });

  it('accepts readonly-providerMetadata messages in handleChatStream v7', () => {
    const messages: AppUIMessage[] = [];
    expectTypeOf(handleChatStream).toBeCallableWith({
      mastra: {} as Mastra,
      agentId: 'agent',
      version: 'v7',
      params: { messages },
    });
  });
});
