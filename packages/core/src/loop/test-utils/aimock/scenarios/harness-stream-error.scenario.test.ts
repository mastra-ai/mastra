import { expect, it } from 'vitest';
import { AGENT_STREAM_TOPIC } from '../../../../agent/durable/constants';
import { EventEmitterPubSub } from '../../../../events';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Harness contract: an error thrown while draining `fullStream` fails the
 * scenario unless it opts in with `expectStreamError`. A broken transport must
 * not read as an empty stream that still passes.
 */

const transportError = new Error('transport closed: connection refused');

// A transport that cannot open the run's stream subscription, like a socket or
// Redis connection that is gone.
class BrokenStreamPubSub extends EventEmitterPubSub {
  override async subscribe(...args: Parameters<EventEmitterPubSub['subscribe']>): Promise<void> {
    if (args[0].startsWith(AGENT_STREAM_TOPIC(''))) throw transportError;
    return super.subscribe(...args);
  }
}

// Only the durable engines read the stream through PubSub. Inngest runs on the
// host's Mastra, which never sees this test's PubSub.
describeForAllEngines(
  'AIMock loop scenario: harness surfaces transport failures',
  engine => {
    const getMock = useLoopScenarioAimock();
    const fixtures = (llm: ReturnType<typeof getMock>) => {
      llm.on({ endpoint: 'chat' }, { content: 'Hello' });
    };

    it('throws when the stream subscription fails and no error was expected', async () => {
      const run = runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Say hello',
        pubsub: new BrokenStreamPubSub(),
        fixtures,
      });

      await expect(run).rejects.toThrow(/stream failed while draining/);
      await expect(run).rejects.toMatchObject({ cause: transportError });
    });

    it('returns the transport error on streamError when the scenario expects it', async () => {
      const { streamError, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Say hello',
        pubsub: new BrokenStreamPubSub(),
        collectChunks: true,
        expectStreamError: true,
        fixtures,
      });

      expect(streamError).toBe(transportError);
      expect(chunks).toEqual([]);
    });
  },
  { skip: ['normal', 'fs', 'inngest'] },
);

// The non-durable drain uses consumeStream(), which resolves on a failed base
// stream and only reports it through onError.
describeForAllEngines(
  'AIMock loop scenario: harness surfaces base stream failures',
  engine => {
    const getMock = useLoopScenarioAimock();
    const fixtures = (llm: ReturnType<typeof getMock>) => {
      llm.on({ endpoint: 'chat' }, { content: 'Hello' });
    };
    const defaultOptions = {
      onFinish: () => {
        throw new Error('onFinish exploded');
      },
    };

    it('throws when the base stream fails and no error was expected', async () => {
      const run = runLoopScenario({ engine, llm: getMock(), prompt: 'Say hello', defaultOptions, fixtures });

      await expect(run).rejects.toThrow(/stream failed while draining/);
      await expect(run).rejects.toMatchObject({ cause: { message: 'onFinish exploded' } });
    });

    it('returns the base stream error on streamError when the scenario expects it', async () => {
      const { streamError } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Say hello',
        defaultOptions,
        expectStreamError: true,
        fixtures,
      });

      expect(streamError).toMatchObject({ message: 'onFinish exploded' });
    });
  },
  { skip: ['durable', 'evented', 'inngest'] },
);
