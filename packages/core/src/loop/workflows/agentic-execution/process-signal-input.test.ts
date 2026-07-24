import { describe, expect, it } from 'vitest';
import type { Agent } from '../../../agent';
import { createSignal } from '../../../agent/signals';
import type { Processor } from '../../../processors';
import { processSignalInput } from './process-signal-input';

function makeSignal(text: string) {
  return createSignal({
    type: 'notification',
    tagName: 'test-signal',
    contents: [{ type: 'text', text }],
  });
}

describe('processSignalInput', () => {
  it('passes the exact owning agent to input processors', async () => {
    const agent = { id: 'owner' } as Agent<any, any, any, any>;
    let observed: unknown;
    const processor: Processor<'agent-observer'> = {
      id: 'agent-observer',
      processInput: ({ agent: contextAgent, messages }) => {
        observed = contextAgent;
        return messages;
      },
    };

    await processSignalInput({ signals: [makeSignal('hello')], inputProcessors: [processor], agent });

    expect(observed).toBe(agent);
  });

  it('drops signals rejected or filtered by input processors', async () => {
    const processor: Processor<'signal-filter'> = {
      id: 'signal-filter',
      processInput: ({ messages, abort }) => {
        const text = messages[0]?.content?.parts?.[0];
        if (text && 'text' in text && text.text.includes('blocked')) abort('blocked');
        return messages.filter(message => {
          const part = message.content?.parts?.[0];
          return !(part && 'text' in part && part.text.includes('spam'));
        });
      },
    };
    const signals = [makeSignal('safe'), makeSignal('blocked'), makeSignal('spam')];

    const result = await processSignalInput({ signals, inputProcessors: [processor] });

    expect(result).toEqual([signals[0]]);
  });

  it('keeps signals when no processors are configured or a processor throws an ordinary error', async () => {
    const signal = makeSignal('hello');
    await expect(processSignalInput({ signals: [signal] })).resolves.toEqual([signal]);

    const processor: Processor<'broken'> = {
      id: 'broken',
      processInput: () => {
        throw new Error('unexpected');
      },
    };
    await expect(processSignalInput({ signals: [signal], inputProcessors: [processor] })).resolves.toEqual([signal]);
  });
});
