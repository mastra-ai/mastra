import { describe, expect, it } from 'vitest';
import { createOrderedToolGates, markOrderedTool, waitForGate } from './ordered-tools';

const tools = {
  a: markOrderedTool({ id: 'a' }, 'g'),
  b: markOrderedTool({ id: 'b' }, 'g'),
  other: markOrderedTool({ id: 'other' }, 'h'),
  plain: { id: 'plain' },
};

describe('createOrderedToolGates', () => {
  it('chains calls of a group in emitted order and leaves other calls ungated', async () => {
    const gates = createOrderedToolGates(
      [
        { toolCallId: '1', toolName: 'a' },
        { toolCallId: '2', toolName: 'plain' },
        { toolCallId: '3', toolName: 'other' },
        { toolCallId: '4', toolName: 'b' },
      ],
      tools,
    );
    expect([...gates.keys()]).toEqual(['1', '3', '4']);

    const order: string[] = [];
    void gates.get('4')!.ready.then(() => order.push('4'));
    void gates.get('3')!.ready.then(() => order.push('3'));
    await gates.get('1')!.ready;
    await Promise.resolve();
    // '3' is in its own group and starts at once; '4' waits for '1'.
    expect(order).toEqual(['3']);

    gates.get('1')!.release();
    gates.get('1')!.release();
    await gates.get('4')!.ready;
    expect(order).toEqual(['3', '4']);
  });

  it('stops waiting when the signal aborts', async () => {
    const controller = new AbortController();
    const waiting = waitForGate(new Promise(() => {}), controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBe(false);
    await expect(waitForGate(Promise.resolve(), undefined)).resolves.toBe(true);
  });
});
