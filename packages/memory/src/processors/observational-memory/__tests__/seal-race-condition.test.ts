import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

// =============================================================================
// Helpers
// =============================================================================

function createOM() {
  const db = new InMemoryDB();
  const storage = new InMemoryMemory({ db });
  const model = new MockLanguageModelV2({});
  return new ObservationalMemory({
    storage,
    scope: 'thread',
    model,
    observation: { messageTokens: 50000 },
    reflection: { observationTokens: 20000 },
  });
}

function makeAssistantMessageWithToolCalls(): {
  message: MastraDBMessage;
  webSearchCallPart: any;
  executeCommandCallPart: any;
} {
  const webSearchCallPart = {
    type: 'tool-invocation' as const,
    toolInvocation: {
      state: 'call' as const,
      toolCallId: 'srvtoolu_018xUv36ckahwqzmCtk1Q9Lh',
      toolName: 'web_search_20250305',
      args: { query: 'tokenx cloudflare workers' },
    },
    providerExecuted: true,
  };

  const executeCommandCallPart = {
    type: 'tool-invocation' as const,
    toolInvocation: {
      state: 'call' as const,
      toolCallId: 'toolu_01Cqd9MCHKWrxGNve6yTRwqq',
      toolName: 'execute_command',
      args: { command: 'ls node_modules/tokenx/', timeout: 5 },
    },
  };

  const content: MastraMessageContentV2 = {
    format: 2,
    parts: [webSearchCallPart as any, executeCommandCallPart as any],
  };

  return {
    message: {
      id: 'assistant-msg-1',
      role: 'assistant',
      content,
      type: 'text',
      createdAt: new Date(),
    },
    webSearchCallPart,
    executeCommandCallPart,
  };
}

function makeAccumulatedMessageWithResults(
  originalId: string,
  webSearchCallPart: any,
  executeCommandCallPart: any,
): MastraDBMessage {
  return {
    id: originalId,
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        webSearchCallPart,
        executeCommandCallPart,
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'toolu_01Cqd9MCHKWrxGNve6yTRwqq',
            toolName: 'execute_command',
            args: { command: 'ls node_modules/tokenx/', timeout: 5 },
            result: 'dist\npackage.json\nREADME.md\n',
          },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'srvtoolu_018xUv36ckahwqzmCtk1Q9Lh',
            toolName: 'web_search_20250305',
            args: { query: 'tokenx cloudflare workers' },
            result: { providerExecuted: true, toolName: 'web_search_20250305' },
          },
          providerExecuted: true,
        },
      ],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  } as MastraDBMessage;
}

/**
 * Check model messages (as the LLM would see them) for orphaned tool calls.
 * Returns the tool call/result ID sets for assertions.
 */
function getToolCallBalance(modelMessages: any[]) {
  const toolCallIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (const msg of modelMessages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-call') toolCallIds.add(part.toolCallId);
      }
    }
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-result') toolResultIds.add(part.toolCallId);
      }
    }
  }

  return { toolCallIds, toolResultIds };
}

// =============================================================================
// Tests
// =============================================================================

describe('Race condition: sealMessagesForBuffering vs tool result delivery', () => {
  /**
   * Simulates the exact race condition from thread 1772736459884-wsggpkj1m:
   *
   * Timeline:
   *   T0: LLM emits web_search (providerExecuted) + execute_command calls
   *   T1: processInputStep triggers startAsyncBufferedObservation (fire-and-forget)
   *   T2: OM's async buffering calls sealMessagesForBuffering on the message
   *       (which still only has calls, results haven't arrived yet)
   *   T3: tool-call-step returns results, AI SDK updates the message
   *
   * With the fix: T2 skips sealing because the message has pending calls.
   *               T3 merges results into the same message. No split. No orphan.
   *
   * Without the fix: T2 seals the message with only calls.
   *                  T3 causes MessageList to split results into a new message.
   *                  output-converter strips the providerExecuted result but keeps
   *                  the providerExecuted call → orphaned server_tool_use → API 400.
   */
  it('fix: sealMessagesForBuffering skips message with pending calls, results merge normally', () => {
    const om = createOM();
    const messageList = new MessageList({ threadId: 'test-thread' });

    // T0: User message + assistant emits tool calls
    messageList.add({ role: 'user', content: 'does tokenx work on cloudflare?' }, 'input');
    const { message, webSearchCallPart, executeCommandCallPart } = makeAssistantMessageWithToolCalls();
    messageList.add(message, 'response');

    // T2: OM's async buffering fires — calls sealMessagesForBuffering on all messages.
    //     The assistant message has pending calls (state: 'call'), so the fix skips it.
    const messagesAtT2 = messageList.get.all.db();

    (om as any).sealMessagesForBuffering(messagesAtT2);

    // Check seal status (with fix: not sealed; without fix: sealed)
    const assistantAtT2 = messagesAtT2.find(m => m.id === 'assistant-msg-1')!;
    const sealMetadata = assistantAtT2.content.metadata as { mastra?: { sealed?: boolean } } | undefined;
    const wasSealed = sealMetadata?.mastra?.sealed === true;

    // T3: Tool results arrive — same message ID, accumulated parts (calls + results)
    const accumulated = makeAccumulatedMessageWithResults('assistant-msg-1', webSearchCallPart, executeCommandCallPart);
    messageList.add(accumulated, 'response');

    const messagesAfter = messageList.get.all.db();
    const promptMessages = messageList.get.all.aiV5.prompt();
    const { toolCallIds, toolResultIds } = getToolCallBalance(promptMessages);

    // Collect all failures so we can see the full picture
    const failures: string[] = [];

    if (wasSealed) {
      failures.push(`SEALED: message with pending tool calls was sealed (should not be)`);
    }
    if (messagesAfter.length !== 2) {
      failures.push(
        `SPLIT: expected 2 messages (user + assistant), got ${messagesAfter.length} (sealed message caused split)`,
      );
    }
    for (const callId of toolCallIds) {
      if (!toolResultIds.has(callId)) {
        failures.push(`ORPHAN: tool call ${callId} has no matching result in model messages → would cause API 400`);
      }
    }

    console.log('failures', failures);

    expect(failures, 'All checks should pass with the fix applied').toEqual([]);
  });

  it('bug repro: sealing message with pending calls causes orphaned provider-executed tool call', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // T0: User message + assistant emits tool calls
    messageList.add({ role: 'user', content: 'does tokenx work on cloudflare?' }, 'input');
    const { message, webSearchCallPart, executeCommandCallPart } = makeAssistantMessageWithToolCalls();
    messageList.add(message, 'response');

    // T2: Manually seal the message (bypassing the fix) to reproduce the bug.
    //     This is what happened before the fix when sealMessagesForBuffering
    //     didn't check for pending tool calls.
    const messagesAtT2 = messageList.get.all.db();
    const assistantAtT2 = messagesAtT2.find(m => m.id === 'assistant-msg-1')!;
    assistantAtT2.content.metadata = { mastra: { sealed: true } };
    const lastPart = assistantAtT2.content.parts[assistantAtT2.content.parts.length - 1] as any;
    lastPart.metadata = { mastra: { sealedAt: Date.now() } };

    // T3: Tool results arrive — sealed message causes MessageList to split
    const accumulated = makeAccumulatedMessageWithResults('assistant-msg-1', webSearchCallPart, executeCommandCallPart);
    // Mirror the sealedAt on the incoming message's boundary part so the split calculation works
    (accumulated.content.parts[1] as any).metadata = {
      mastra: { sealedAt: lastPart.metadata.mastra.sealedAt },
    };
    messageList.add(accumulated, 'response');

    // Split happened: 3 messages
    const messagesAfter = messageList.get.all.db();
    expect(messagesAfter.length, 'sealed message causes split → 3 messages').toBe(3);

    // Model messages have an orphaned web_search call (the bug)
    const promptMessages = messageList.get.all.aiV5.prompt();
    const { toolCallIds, toolResultIds } = getToolCallBalance(promptMessages);

    const webSearchCallId = 'srvtoolu_018xUv36ckahwqzmCtk1Q9Lh';
    expect(toolCallIds.has(webSearchCallId), 'web_search call should be in model messages').toBe(true);
    expect(toolResultIds.has(webSearchCallId), 'web_search result should be stripped (bug)').toBe(false);
  });

  it('sealMessagesForBuffering seals messages once all tool calls have results', () => {
    const om = createOM();

    // A message where both tools have completed (state: 'result')
    const completedMessage: MastraDBMessage = {
      id: 'msg-complete',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'srvtoolu_test',
              toolName: 'web_search_20250305',
              args: { query: 'test' },
              result: { providerExecuted: true, toolName: 'web_search_20250305' },
            },
            providerExecuted: true,
          } as any,
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'toolu_test',
              toolName: 'execute_command',
              args: { command: 'ls' },
              result: 'files',
            },
          } as any,
        ],
      },
      type: 'text',
      createdAt: new Date(),
    };

    (om as any).sealMessagesForBuffering([completedMessage]);

    const metadata = completedMessage.content.metadata as { mastra?: { sealed?: boolean } };
    expect(metadata.mastra?.sealed, 'completed message should be sealed').toBe(true);
  });
});
