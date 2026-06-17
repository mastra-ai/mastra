import { describe, it, expect, vi } from 'vitest';
import { createSignal } from '../../../agent/signals';
import { TripWire } from '../../../agent/trip-wire';
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
  it('returns all signals when no processors are configured', async () => {
    const signals = [makeSignal('hello'), makeSignal('world')];
    const result = await processSignalInput({ signals, inputProcessors: [] });
    expect(result).toHaveLength(2);
  });

  it('returns all signals when processors is undefined', async () => {
    const signals = [makeSignal('hello')];
    const result = await processSignalInput({ signals, inputProcessors: undefined });
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty signals', async () => {
    const result = await processSignalInput({ signals: [], inputProcessors: [] });
    expect(result).toHaveLength(0);
  });

  it('drops signals that trigger a TripWire', async () => {
    const blockingProcessor: Processor<'test-blocker'> = {
      id: 'test-blocker',
      name: 'Test Blocker',
      processInput: ({ messages, abort }) => {
        const text = messages[0]?.content?.parts?.[0];
        if (text && 'text' in text && text.text.includes('blocked')) {
          abort('Content blocked');
        }
        return messages;
      },
    };

    const signals = [makeSignal('safe content'), makeSignal('this is blocked content'), makeSignal('also safe')];

    const result = await processSignalInput({
      signals,
      inputProcessors: [blockingProcessor],
      agentId: 'test-agent',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(signals[0]);
    expect(result[1]).toBe(signals[2]);
  });

  it('drops signals that are filtered out by a processor', async () => {
    const filteringProcessor: Processor<'test-filter'> = {
      id: 'test-filter',
      name: 'Test Filter',
      processInput: ({ messages }) => {
        // Filter out messages containing 'spam'
        return messages.filter(m => {
          const text = m.content?.parts?.[0];
          return !(text && 'text' in text && text.text.includes('spam'));
        });
      },
    };

    const signals = [makeSignal('good content'), makeSignal('spam message')];

    const result = await processSignalInput({
      signals,
      inputProcessors: [filteringProcessor],
      agentId: 'test-agent',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(signals[0]);
  });

  it('passes signals through when processor does not block or filter', async () => {
    const passThroughProcessor: Processor<'test-passthrough'> = {
      id: 'test-passthrough',
      name: 'Test PassThrough',
      processInput: ({ messages }) => messages,
    };

    const signals = [makeSignal('hello'), makeSignal('world')];

    const result = await processSignalInput({
      signals,
      inputProcessors: [passThroughProcessor],
      agentId: 'test-agent',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(signals[0]);
    expect(result[1]).toBe(signals[1]);
  });

  it('still approves signal when processor throws non-TripWire error', async () => {
    const errorProcessor: Processor<'test-error'> = {
      id: 'test-error',
      name: 'Test Error',
      processInput: () => {
        throw new Error('unexpected error');
      },
    };

    const signals = [makeSignal('hello')];

    const result = await processSignalInput({
      signals,
      inputProcessors: [errorProcessor],
      agentId: 'test-agent',
    });

    // Non-TripWire errors don't reject the signal
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(signals[0]);
  });

  it('runs multiple processors in sequence', async () => {
    const calls: string[] = [];
    const processor1: Processor<'p1'> = {
      id: 'p1',
      name: 'P1',
      processInput: ({ messages }) => {
        calls.push('p1');
        return messages;
      },
    };
    const processor2: Processor<'p2'> = {
      id: 'p2',
      name: 'P2',
      processInput: ({ messages }) => {
        calls.push('p2');
        return messages;
      },
    };

    const signals = [makeSignal('test')];
    await processSignalInput({
      signals,
      inputProcessors: [processor1, processor2],
      agentId: 'test-agent',
    });

    expect(calls).toEqual(['p1', 'p2']);
  });
});
