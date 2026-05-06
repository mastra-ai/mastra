import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from '../cache';
import { getOpenAIReasoningItemId, getResponseProviderItemIdFromPart, MessageList } from '../index';

/**
 * Verifies that OpenAI reasoning parts and itemId metadata survive the
 * MessageList → prompt() round-trip.
 *
 * OpenAI reasoning models (gpt-5-mini, gpt-5.2, etc.) produce reasoning parts with
 * providerMetadata.openai.itemId (rs_* for reasoning, msg_* for text, fc_* for tool calls).
 * The Responses API enforces mandatory pairing between these items — when store=true (default),
 * the SDK sends item_reference for parts with itemIds, and OpenAI looks them up server-side.
 *
 * If reasoning is stripped but text/tool itemIds remain, OpenAI rejects with:
 *   "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item"
 *
 * Fixture format is based on real gpt-5-mini API responses:
 *   - reasoning.text is empty (encrypted/hidden from the client)
 *   - reasoningEncryptedContent is null (opaque server-side field)
 *   - itemIds are hex strings prefixed with rs_, msg_, or fc_
 */
describe('OpenAI reasoning round-trip', () => {
  it('should keep OpenAI-specific and provider-neutral itemId helpers distinct', () => {
    const openaiPart = {
      providerMetadata: {
        openai: { itemId: 'rs_openai' },
      },
    };
    const azurePart = {
      providerMetadata: {
        azure: { itemId: 'rs_azure' },
      },
    };
    const azurePromptPart = {
      providerOptions: {
        azure: { itemId: 'rs_azure_prompt' },
      },
    };

    expect(getOpenAIReasoningItemId(openaiPart)).toBe('rs_openai');
    expect(getOpenAIReasoningItemId(azurePart)).toBeUndefined();
    expect(getResponseProviderItemIdFromPart(azurePart)).toEqual({ provider: 'azure', itemId: 'rs_azure' });
    expect(getResponseProviderItemIdFromPart(azurePromptPart)).toEqual({
      provider: 'azure',
      itemId: 'rs_azure_prompt',
    });
  });

  /**
   * Simple case: reasoning + text in a single message, added via 'response' source
   * (which merges into one assistant message).
   */
  it('should preserve reasoning parts and openai metadata in prompt()', () => {
    const list = new MessageList();

    list.add({ role: 'user', content: 'What is 2+2? Answer in one word.' }, 'input');

    // Assistant response with reasoning + text, matching real gpt-5-mini output shape
    list.add(
      {
        id: 'msg-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                openai: {
                  itemId: 'rs_0897c6e765af7e6a0069de97733ac881',
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'text',
              text: 'Four',
              providerMetadata: {
                openai: {
                  itemId: 'msg_0897c6e765af7e6a0069de9774280c81',
                },
              },
            },
          ],
        },
        createdAt: new Date(),
        threadId: 'thread-1',
      },
      'response',
    );

    list.add({ role: 'user', content: 'Now what is 3+3?' }, 'input');

    const prompt = list.get.all.aiV5.prompt();

    const assistantMessages = prompt.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);

    const content = assistantMessages[0].content;
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) throw new Error('Expected array content');

    // Reasoning parts must be preserved
    const reasoningParts = content.filter((p: any) => p.type === 'reasoning');
    expect(reasoningParts).toHaveLength(1);

    // Text parts must be preserved
    const textParts = content.filter((p: any) => p.type === 'text');
    expect(textParts).toHaveLength(1);
    expect((textParts[0] as any).text).toBe('Four');

    // providerOptions.openai (mapped from providerMetadata) must be preserved
    // so the SDK can send item_reference
    const reasoningOpts = (reasoningParts[0] as any).providerOptions?.openai;
    expect(reasoningOpts).toBeDefined();
    expect(reasoningOpts.itemId).toBe('rs_0897c6e765af7e6a0069de97733ac881');

    const textOpts = (textParts[0] as any).providerOptions?.openai;
    expect(textOpts).toBeDefined();
    expect(textOpts.itemId).toBe('msg_0897c6e765af7e6a0069de9774280c81');
  });

  /**
   * Multi-step case: assistant reasons + calls tool, then reasons + responds with text.
   * Both steps are added via 'response' source (merged into one assistant message).
   */
  it('should preserve reasoning parts alongside tool calls in prompt()', () => {
    const list = new MessageList();

    list.add({ role: 'user', content: 'What is the weather in Paris?' }, 'input');

    // Step 1: reasoning + tool call
    list.add(
      {
        id: 'msg-assistant-tool',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                openai: {
                  itemId: 'rs_step1_reasoning',
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_weather1',
                toolName: 'get_weather',
                args: { location: 'Paris' },
                result: { temp: 22, condition: 'sunny' },
              },
              providerMetadata: {
                openai: {
                  itemId: 'fc_step1_toolcall',
                },
              },
            },
          ],
        },
        createdAt: new Date(),
        threadId: 'thread-1',
      },
      'response',
    );

    // Step 2: reasoning + text response (merged into same assistant message)
    list.add(
      {
        id: 'msg-assistant-final',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                openai: {
                  itemId: 'rs_step2_reasoning',
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'text',
              text: 'The weather in Paris is 22°C and sunny.',
              providerMetadata: {
                openai: {
                  itemId: 'msg_step2_text',
                },
              },
            },
          ],
        },
        createdAt: new Date(),
        threadId: 'thread-1',
      },
      'response',
    );

    list.add({ role: 'user', content: 'What about tomorrow?' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistantMessages = prompt.filter(m => m.role === 'assistant');
    const allParts = assistantMessages.flatMap(m => (Array.isArray(m.content) ? m.content : []));

    // ALL reasoning parts must be preserved
    const reasoningParts = allParts.filter((p: any) => p.type === 'reasoning');
    expect(reasoningParts.length).toBeGreaterThanOrEqual(2);

    // Tool call parts must be preserved
    const toolCallParts = allParts.filter((p: any) => p.type === 'tool-call');
    expect(toolCallParts.length).toBeGreaterThanOrEqual(1);

    // Text parts must be preserved
    const textParts = allParts.filter((p: any) => p.type === 'text');
    expect(textParts.length).toBeGreaterThanOrEqual(1);

    // providerOptions.openai must be present on all parts that had it —
    // if reasoning is stripped but tool/text metadata remains, OpenAI rejects
    for (const part of allParts) {
      const p = part as any;
      if (p.type === 'reasoning' || p.type === 'text' || p.type === 'tool-call') {
        expect(p.providerOptions?.openai).toBeDefined();
      }
    }
  });

  it('should preserve Azure OpenAI reasoning metadata in prompt()', () => {
    const list = new MessageList();

    list.add({ role: 'user', content: 'Use the tool and summarize.' }, 'input');
    list.add(
      {
        id: 'msg-azure-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                azure: {
                  itemId: 'rs_azure_reasoning',
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_azure_tool',
                toolName: 'lookup',
                args: { query: 'status' },
                result: { status: 'ok' },
              },
              providerMetadata: {
                azure: {
                  itemId: 'fc_azure_toolcall',
                },
              },
            },
          ],
        },
        createdAt: new Date(),
        threadId: 'thread-1',
      },
      'response',
    );

    list.add({ role: 'user', content: 'Continue.' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistantMessages = prompt.filter(m => m.role === 'assistant');
    const allParts = assistantMessages.flatMap(m => (Array.isArray(m.content) ? m.content : []));

    const reasoningParts = allParts.filter((p: any) => p.type === 'reasoning');
    expect(reasoningParts).toHaveLength(1);
    expect((reasoningParts[0] as any).providerOptions?.azure?.itemId).toBe('rs_azure_reasoning');
    expect((reasoningParts[0] as any).providerOptions?.openai).toBeUndefined();

    const toolCallParts = allParts.filter((p: any) => p.type === 'tool-call');
    expect(toolCallParts).toHaveLength(1);
    expect((toolCallParts[0] as any).providerOptions?.azure?.itemId).toBe('fc_azure_toolcall');
    expect((toolCallParts[0] as any).providerOptions?.openai).toBeUndefined();
  });

  it('should distinguish empty Azure reasoning parts in AI SDK v5 cache keys', () => {
    const first = [
      {
        type: 'reasoning',
        text: '',
        providerMetadata: {
          azure: {
            itemId: 'rs_azure_first',
          },
        },
      },
    ];
    const second = [
      {
        type: 'reasoning',
        text: '',
        providerMetadata: {
          azure: {
            itemId: 'rs_azure_second',
          },
        },
      },
    ];

    expect(CacheKeyGenerator.fromAIV5Parts(first as any)).not.toBe(CacheKeyGenerator.fromAIV5Parts(second as any));
  });

  it('should distinguish equal Azure text parts with different itemIds in cache keys', () => {
    const uiFirst = [
      {
        type: 'text',
        text: 'Same text',
        providerMetadata: { azure: { itemId: 'msg_azure_first' } },
      },
    ];
    const uiSecond = [
      {
        type: 'text',
        text: 'Same text',
        providerMetadata: { azure: { itemId: 'msg_azure_second' } },
      },
    ];
    const modelFirst = [
      {
        type: 'text',
        text: 'Same text',
        providerOptions: { azure: { itemId: 'msg_azure_first' } },
      },
    ];
    const modelSecond = [
      {
        type: 'text',
        text: 'Same text',
        providerOptions: { azure: { itemId: 'msg_azure_second' } },
      },
    ];

    expect(CacheKeyGenerator.fromAIV4Parts(uiFirst as any)).not.toBe(CacheKeyGenerator.fromAIV4Parts(uiSecond as any));
    expect(CacheKeyGenerator.fromAIV5Parts(uiFirst as any)).not.toBe(CacheKeyGenerator.fromAIV5Parts(uiSecond as any));
    expect(CacheKeyGenerator.fromAIV4CoreMessageContent(modelFirst as any)).not.toBe(
      CacheKeyGenerator.fromAIV4CoreMessageContent(modelSecond as any),
    );
    expect(CacheKeyGenerator.fromAIV5ModelMessageContent(modelFirst as any)).not.toBe(
      CacheKeyGenerator.fromAIV5ModelMessageContent(modelSecond as any),
    );
  });

  it('should distinguish empty Azure reasoning parts in AI SDK v4 CoreMessage cache keys', () => {
    const first = [
      {
        type: 'reasoning',
        text: '',
        providerOptions: {
          azure: {
            itemId: 'rs_azure_first',
          },
        },
      },
    ];
    const second = [
      {
        type: 'reasoning',
        text: '',
        providerOptions: {
          azure: {
            itemId: 'rs_azure_second',
          },
        },
      },
    ];

    expect(CacheKeyGenerator.fromAIV4CoreMessageContent(first as any)).not.toBe(
      CacheKeyGenerator.fromAIV4CoreMessageContent(second as any),
    );
  });

  it('should canonicalize mirrored Azure and OpenAI itemIds in cache keys', () => {
    const azureOnly = [
      {
        type: 'reasoning',
        text: '',
        providerOptions: {
          azure: {
            itemId: 'rs_azure_mirrored',
          },
        },
      },
    ];
    const mirrored = [
      {
        type: 'reasoning',
        text: '',
        providerOptions: {
          azure: {
            itemId: 'rs_azure_mirrored',
          },
          openai: {
            itemId: 'rs_azure_mirrored',
          },
        },
      },
    ];

    expect(CacheKeyGenerator.fromAIV4CoreMessageContent(azureOnly as any)).toBe(
      CacheKeyGenerator.fromAIV4CoreMessageContent(mirrored as any),
    );
  });

  it('should canonicalize mirrored Azure and OpenAI text itemIds in cache keys', () => {
    const azureOnly = [
      {
        type: 'text',
        text: 'Same text',
        providerOptions: {
          azure: {
            itemId: 'msg_azure_mirrored',
          },
        },
      },
    ];
    const mirrored = [
      {
        type: 'text',
        text: 'Same text',
        providerOptions: {
          azure: {
            itemId: 'msg_azure_mirrored',
          },
          openai: {
            itemId: 'msg_azure_mirrored',
          },
        },
      },
    ];

    expect(CacheKeyGenerator.fromAIV5ModelMessageContent(azureOnly as any)).toBe(
      CacheKeyGenerator.fromAIV5ModelMessageContent(mirrored as any),
    );
  });
});
