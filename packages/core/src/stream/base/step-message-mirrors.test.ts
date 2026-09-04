import { describe, expect, it } from 'vitest';
import { convertMessages, MessageList } from '../../agent/message-list';
import { packStepMessageMirrors, unpackStepMessageMirrors } from './step-message-mirrors';

describe('step message mirrors', () => {
  /**
   * Mirrors what `step-finish` buffers: after each assistant turn the step
   * records the whole response conversation so far, not just its own message.
   */
  function runSteps(count: number) {
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
        request: { body: 'prompt', headers: { 'x-step': String(i) } },
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

  it('replaces the cumulative mirrors with message IDs and rebuilds them exactly', () => {
    const { messageList, steps } = runSteps(6);

    const packed = packStepMessageMirrors(structuredClone(steps));
    expect(
      packed.every(s => !('dbMessages' in s.response) && !('uiMessages' in s.response) && !('messages' in s.response)),
    ).toBe(true);
    expect(packed.map(s => (s.response as any).__responseMessageIds)).toEqual(
      steps.map(s => s.response.dbMessages.map(message => message.id)),
    );

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

  it('uses stable message identities when messages move between sources or are removed', () => {
    const { messageList, steps } = runSteps(3);
    const packed = packStepMessageMirrors(structuredClone(steps));
    const finalStepIds = steps.at(-1)!.response.dbMessages.map(message => message.id);
    const promotedId = finalStepIds[0]!;
    const removedId = finalStepIds[1]!;

    const responseMessages = messageList.clear.response.db();
    for (const message of responseMessages) {
      if (message.id === removedId) continue;
      messageList.add(message, message.id === promotedId ? 'memory' : 'response');
    }

    const restored = unpackStepMessageMirrors(packed, messageList);
    const restoredIds = restored.at(-1)!.response.dbMessages.map(message => message.id);

    expect(restoredIds).toContain(promotedId);
    expect(restoredIds).not.toContain(removedId);
    expect(restoredIds).toEqual(finalStepIds.filter(id => id !== removedId));
  });

  it('keeps the serialized snapshot linear in step count', () => {
    const size = (n: number) => {
      const { steps } = runSteps(n);
      return JSON.stringify(packStepMessageMirrors(steps)).length;
    };

    // Quadratic growth would put this near 4x; linear puts it near 2x.
    expect(size(16) / size(8)).toBeLessThan(2.5);
  });

  it('preserves each step request unchanged', () => {
    const { steps } = runSteps(4);
    const packed = packStepMessageMirrors(steps);

    expect(packed.map(step => step.request)).toEqual(steps.map(step => step.request));
  });

  it('rebuilds mirrors lazily and caches each conversion', () => {
    const { messageList, steps } = runSteps(3);
    const restored = unpackStepMessageMirrors(packStepMessageMirrors(steps), messageList);
    const response = restored[0]!.response;

    expect(Object.getOwnPropertyDescriptor(response, 'dbMessages')?.get).toBeTypeOf('function');
    expect(Object.getOwnPropertyDescriptor(response, 'uiMessages')?.get).toBeTypeOf('function');
    expect(response.dbMessages).toBe(response.dbMessages);
    expect(response.uiMessages).toBe(response.uiMessages);
    expect(response.messages).toBe(response.messages);
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
