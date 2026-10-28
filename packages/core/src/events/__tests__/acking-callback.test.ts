import { describe, expect, it, vi } from 'vitest';
import { withAck } from '../acking-callback';
import type { Event } from '../types';

const event = { id: 'evt', type: 'test', runId: 'run', createdAt: new Date(), data: {} } as Event;

describe('withAck', () => {
  describe('when the handler resolves', () => {
    it('acknowledges the delivery', async () => {
      const ack = vi.fn(async () => {});
      const handler = vi.fn();

      await withAck(handler)(event, ack);

      expect(handler).toHaveBeenCalledWith(event);
      expect(ack).toHaveBeenCalledTimes(1);
    });

    it('acknowledges a delivery the handler filters out', async () => {
      const ack = vi.fn(async () => {});

      // The whole point of the wrapper: a handler that inspects and skips an
      // event still has to ack it, or a durable backend keeps it pending.
      await withAck(() => {})(event, ack);

      expect(ack).toHaveBeenCalledTimes(1);
    });

    it('acknowledges after an async handler settles', async () => {
      const order: string[] = [];
      const ack = async () => {
        order.push('ack');
      };

      await withAck(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        order.push('handled');
      })(event, ack);

      expect(order).toEqual(['handled', 'ack']);
    });

    it('tolerates a backend that does not offer ack', async () => {
      await expect(withAck(() => {})(event)).resolves.toBeUndefined();
    });
  });

  describe('when the handler throws', () => {
    it('does not acknowledge and lets the rejection through', async () => {
      const ack = vi.fn(async () => {});
      const failure = new Error('handler failed');

      // Rejection is what a redelivering backend reads as a nack.
      await expect(withAck(() => Promise.reject(failure))(event, ack)).rejects.toThrow(failure);
      expect(ack).not.toHaveBeenCalled();
    });

    it('does not acknowledge a synchronous throw', async () => {
      const ack = vi.fn(async () => {});

      await expect(
        withAck(() => {
          throw new Error('sync failure');
        })(event, ack),
      ).rejects.toThrow('sync failure');
      expect(ack).not.toHaveBeenCalled();
    });
  });
});
