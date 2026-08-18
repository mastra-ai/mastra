import { describe, expect, it } from 'vitest';
import { convertMessages, MessageList } from '../../agent/message-list';
import { packStepMessageMirrors, unpackStepMessageMirrors } from './step-message-mirrors';

describe('step message mirrors', () => {
  /**
   * Mirrors what `step-finish` buffers: after each assistant turn the step
   * records the whole response conversation so far, not just its own message.
   */
  function runSteps(count: number, { requestBody }: { requestBody?: (i: number) => string } = {}) {
    const messageList = new MessageList({ threadId: 't', resourceId: 'r' });
    const steps = Array.from({ length: count }, (_, i) => {
      // An agentic turn appends an assistant message and the tool message that
      // answers it; alternating roles is what keeps them from being merged.
      messageList.add(
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: `call-${i}`, toolName: 'echo', args: { i } }],
        },
        'response',
      );
      messageList.add(
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: `call-${i}`, toolName: 'echo', result: { i } }],
        },
        'response',
      );
      return {
        stepType: i === 0 ? 'initial' : 'tool-result',
        text: `turn ${i}`,
        request: { body: requestBody?.(i) ?? 'prompt', headers: { 'x-step': String(i) } },
        response: {
          id: `res-${i}`,
          modelId: 'mock',
          messages: messageList.get.response.aiV5.model(),
          dbMessages: messageList.get.response.db(),
          uiMessages: messageList.get.response.aiV5.ui(),
        },
      };
    });
    return { messageList, steps };
  }

  it('replaces the cumulative mirrors with a count and rebuilds them exactly', () => {
    const { messageList, steps } = runSteps(6);

    const packed = packStepMessageMirrors(structuredClone(steps));
    expect(
      packed.every(s => !('dbMessages' in s.response) && !('uiMessages' in s.response) && !('messages' in s.response)),
    ).toBe(true);
    expect(packed.map(s => (s.response as any).__responseMessageCount)).toEqual(
      steps.map(s => s.response.dbMessages.length),
    );
    // The message list merges an agentic turn into a single growing message, so
    // the count can repeat — it only has to be non-decreasing for the slice to
    // reconstruct each step.
    const counts = packed.map(s => (s.response as any).__responseMessageCount as number);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));

    const restored = unpackStepMessageMirrors(packed, messageList);
    restored.forEach((step, i) => {
      expect(step.response.dbMessages).toEqual(steps[i]!.response.dbMessages);
      // Each step's mirrors agree with each other, and the last step — the one
      // a resume actually continues from — matches what the run held.
      expect(step.response.uiMessages).toEqual(convertMessages(step.response.dbMessages).to('AIV5.UI'));
    });
    expect(restored.at(-1)!.response.uiMessages).toEqual(steps.at(-1)!.response.uiMessages);
    expect(restored.at(-1)!.response.messages).toEqual(steps.at(-1)!.response.messages);
  });

  it('keeps the serialized snapshot linear in step count', () => {
    const size = (n: number) => {
      const { steps } = runSteps(n);
      return JSON.stringify(packStepMessageMirrors(steps)).length;
    };

    // Quadratic growth would put this near 4x; linear puts it near 2x.
    expect(size(16) / size(8)).toBeLessThan(2.5);
  });

  it('drops the per-step request body but keeps the rest of the request', () => {
    const { steps } = runSteps(4, { requestBody: i => `prompt-${i}-${'x'.repeat(1000)}` });
    const packed = packStepMessageMirrors(steps);

    expect(JSON.stringify(packed)).not.toContain('xxxx');
    expect(packed.map(s => (s.request as any).headers['x-step'])).toEqual(['0', '1', '2', '3']);
  });

  it('leaves snapshots written before this change untouched', () => {
    const { messageList, steps } = runSteps(3);
    expect(unpackStepMessageMirrors(steps, messageList)).toBe(steps);
  });

  it('passes through steps with no response or no message mirrors', () => {
    const steps = [{ stepType: 'a' }, { stepType: 'b', response: { id: 'x' } }] as any[];
    expect(packStepMessageMirrors(steps)).toEqual(steps);
  });
});
