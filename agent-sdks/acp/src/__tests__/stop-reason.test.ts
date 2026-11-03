import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AcpAgent } from '../agent';
import { ACPConnection } from '../connection';

const fixture = fileURLToPath(new URL('./fixtures/stop-reason-agent.mjs', import.meta.url));
const incompleteStopReasons = ['max_tokens', 'cancelled', 'max_turn_requests', 'refusal'] as const;

function peerOptions(stopReason: string) {
  return {
    id: `acp-${stopReason}`,
    description: 'ACP stop reason fixture',
    command: process.execPath,
    args: [fixture, stopReason],
    persistSession: false,
  };
}

describe('ACP prompt stop reasons', { timeout: 10_000 }, () => {
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(async () => {
    // Give any stray rejection a chance to surface before checking.
    await new Promise(resolve => setTimeout(resolve, 50));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('resolves prompt() with the streamed text on end_turn', async () => {
    const connection = new ACPConnection(peerOptions('end_turn'));
    await expect(connection.prompt('hi')).resolves.toBe('partial');
  });

  it.each(incompleteStopReasons)('rejects prompt() on %s', async stopReason => {
    const connection = new ACPConnection(peerOptions(stopReason));
    await expect(connection.prompt('hi')).rejects.toThrow(`ACP prompt stopped before completing: ${stopReason}`);
  });

  it.each(incompleteStopReasons)('rejects AcpAgent.generate() on %s', async stopReason => {
    const agent = new AcpAgent(peerOptions(stopReason));
    await expect(agent.generate('hi')).rejects.toThrow(`ACP prompt stopped before completing: ${stopReason}`);
  });

  it.each(incompleteStopReasons)('rejects AcpAgent.stream() text on %s', async stopReason => {
    const agent = new AcpAgent(peerOptions(stopReason));
    const result = await agent.stream('hi');
    const textAssertion = expect(result.text).rejects.toThrow(`ACP prompt stopped before completing: ${stopReason}`);

    const reader = result.fullStream.getReader();
    await expect(
      (async () => {
        while (!(await reader.read()).done) {}
      })(),
    ).rejects.toThrow(stopReason);
    await textAssertion;
  });

  it.each(incompleteStopReasons)(
    'rejects AcpAgent.stream() fullStream on %s without touching text',
    async stopReason => {
      const agent = new AcpAgent(peerOptions(stopReason));
      const result = await agent.stream('hi');

      const reader = result.fullStream.getReader();
      await expect(
        (async () => {
          while (!(await reader.read()).done) {}
        })(),
      ).rejects.toThrow(`ACP prompt stopped before completing: ${stopReason}`);
    },
  );

  it('rejects AcpAgent.stream() text on max_tokens even when onFinish throws', async () => {
    const agent = new AcpAgent(peerOptions('max_tokens'));
    const result = await agent.stream('hi', {
      onFinish: () => {
        throw new Error('onFinish failed');
      },
    });

    await expect(result.text).rejects.toThrow('ACP prompt stopped before completing: max_tokens');
  });
});
