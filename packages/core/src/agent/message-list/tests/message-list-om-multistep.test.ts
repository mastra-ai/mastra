/**
 * Tests for ObservationalMemory multi-step text persistence (issue #14926)
 *
 * When ObservationalMemory is enabled and an agent performs tool calls (step 1)
 * then generates a text response (step 2), step.prepare() saves and re-tags the
 * step-1 assistant message as 'memory'. Step-2 text then merges into it via
 * MessageMerger. The merged message must remain in (or be promoted back to) the
 * 'response' source set so that turn.end() can re-persist it.
 *
 * Previously, addToSource('response') silently left the message in the
 * memoryMessages Set as well, causing clear.response.db() inside a subsequent
 * prepare() to drop the message from response tracking — making the step-2 text
 * invisible to turn.end() and permanently lost on reload.
 */

import { describe, it, expect } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssistantMsg(id: string, threadId: string, parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return {
    id,
    threadId,
    role: 'assistant',
    type: 'text',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MessageList: ObservationalMemory multi-step text persistence (issue #14926)', () => {
  const THREAD = 'thread-om-multistep';

  it('step-2 text merged into a memory-re-tagged message is tracked as a response message', () => {
    const list = new MessageList({ threadId: THREAD });

    // ── Simulate user message ──────────────────────────────────────────────
    list.add({ role: 'user', content: 'Do something that needs a tool' }, 'input');

    // ── Step 1: agent makes a tool call ─────────────────────────────────────
    const step1Id = 'step1-assistant';
    const toolCallPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        toolCallId: 'call-1',
        toolName: 'lookup',
        state: 'result' as const,
        args: { query: 'test' },
        result: 'result data',
      },
    };

    list.add(makeAssistantMsg(step1Id, THREAD, [toolCallPart]), 'response');

    // Confirm it starts in the response set
    expect(list.get.response.db().some(m => m.id === step1Id)).toBe(true);

    // ── step.prepare() for step 2 (mimics ObservationStep.prepare lines 167-174) ──
    //   clear.response.db() removes step-1 from the response set
    const cleared = list.clear.response.db();
    expect(cleared.some(m => m.id === step1Id)).toBe(true);

    //   re-add as 'memory' (simulates om.persistMessages + messageList.add(msg, 'memory'))
    for (const msg of cleared) {
      list.add(msg, 'memory');
    }

    // After re-tagging: step-1 should be in memory set, NOT in response set
    expect(list.get.response.db().some(m => m.id === step1Id)).toBe(false);

    // ── Step 2: streaming text merges into step-1 (same ID → merge path) ──
    //   The incoming message has source='response'; MessageMerger.merge() appends
    //   the text part into the step-1 object, then pushMessageToSource promotes it.
    const step2TextPart = { type: 'text' as const, text: 'Here is my answer after the tool call.' };
    list.add(makeAssistantMsg(step1Id, THREAD, [...cleared[0]!.content.parts, step2TextPart]), 'response');

    // ── Core assertion: the merged message must be in the response set ──────
    //   This is what turn.end() inspects to decide what to re-persist.
    const responseMessages = list.get.response.db();
    const mergedMsg = responseMessages.find(m => m.id === step1Id);
    expect(mergedMsg).toBeDefined();
    expect(mergedMsg?.content.parts.some(p => p.type === 'text')).toBe(true);
  });

  it('after promotion to response, the message is no longer in the memory set', () => {
    const list = new MessageList({ threadId: THREAD });

    list.add({ role: 'user', content: 'Hello' }, 'input');

    const step1Id = 'step1-b';
    const toolPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        toolCallId: 'call-b',
        toolName: 'search',
        state: 'result' as const,
        args: {},
        result: 'ok',
      },
    };

    list.add(makeAssistantMsg(step1Id, THREAD, [toolPart]), 'response');

    // Simulate step.prepare(): clear + re-add as memory
    const saved = list.clear.response.db();
    for (const msg of saved) {
      list.add(msg, 'memory');
    }

    // Confirm it's in memory before the step-2 merge
    const sourceChecker = list.makeMessageSourceChecker();
    expect(sourceChecker.memory.has(step1Id)).toBe(true);
    expect(sourceChecker.output.has(step1Id)).toBe(false);

    // Step-2 text merges → promotes back to response
    const textPart = { type: 'text' as const, text: 'Step 2 answer' };
    list.add(makeAssistantMsg(step1Id, THREAD, [...saved[0]!.content.parts, textPart]), 'response');

    // After promotion: NOT in memory, IS in response
    const newChecker = list.makeMessageSourceChecker();
    expect(newChecker.memory.has(step1Id)).toBe(false);
    expect(newChecker.output.has(step1Id)).toBe(true);
  });

  it('a subsequent clear.response.db() correctly captures the promoted message', () => {
    // This test validates that turn.end() would find the message even if
    // a third step's prepare() calls clear.response.db() before turn.end().
    const list = new MessageList({ threadId: THREAD });

    list.add({ role: 'user', content: 'Hello' }, 'input');

    const step1Id = 'step1-c';
    const toolPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        toolCallId: 'call-c',
        toolName: 'read',
        state: 'result' as const,
        args: {},
        result: 'data',
      },
    };

    list.add(makeAssistantMsg(step1Id, THREAD, [toolPart]), 'response');

    // Step 2 prepare: clear + re-add as memory
    const saved = list.clear.response.db();
    for (const msg of saved) {
      list.add(msg, 'memory');
    }

    // Step 2 text merges
    const textPart = { type: 'text' as const, text: 'Answer' };
    list.add(makeAssistantMsg(step1Id, THREAD, [...saved[0]!.content.parts, textPart]), 'response');

    // Simulate turn.end() collecting unsaved messages
    const unsavedOutput = list.get.response.db();
    expect(unsavedOutput.some(m => m.id === step1Id)).toBe(true);

    const targetMsg = unsavedOutput.find(m => m.id === step1Id);
    expect(targetMsg?.content.parts.some(p => p.type === 'text')).toBe(true);
    expect((targetMsg?.content.parts.find(p => p.type === 'text') as { text?: string })?.text).toBe('Answer');
  });
});
