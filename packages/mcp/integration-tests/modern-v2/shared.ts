import { createMCPTool } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { createRequestStateCodec, inputRequired } from '@modelcontextprotocol/server';
import { z } from 'zod';

type BookingState = { phase: 'address'; opKey: string } | { phase: 'confirm'; opKey: string; address: string };

export const codec = createRequestStateCodec<BookingState>({ key: 'packed-consumer-proof-key-0123456789abcdef' });

export const journal = { bookings: new Map<string, string>(), writes: 0 };

/** Ordinary business tool: reusable by agents and workflows; receives no legacy `context.mcp`. */
export const echo = createTool({
  id: 'echo',
  description: 'Echo a message',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ echoed: z.string(), hadLegacyContext: z.boolean() }),
  execute: async ({ message }, context) => ({ echoed: message, hadLegacyContext: 'mcp' in (context ?? {}) }),
});

/** Native tool: address round, confirmation round, one counted booking write. */
export const bookDelivery = createMCPTool({
  id: 'bookDelivery',
  description: 'Books a delivery after collecting an address and a confirmation',
  inputSchema: z.object({ opKey: z.string() }),
  outputSchema: z.object({ status: z.string(), address: z.string().optional(), writes: z.number() }),
  execute: async ({ opKey }, { request }) => {
    const state = request.requestState as BookingState | undefined;
    const responses = request.inputResponses ?? {};
    if (!state) {
      await request.log('info', { message: `start ${opKey}` });
      return {
        kind: 'input_required',
        result: inputRequired({
          inputRequests: {
            address: inputRequired.elicit({
              message: 'Delivery address?',
              requestedSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] },
            }),
          },
          requestState: await codec.mint({ phase: 'address', opKey }),
        }),
      };
    }
    if (state.opKey !== opKey) throw new Error('Continuation belongs to a different operation');
    if (state.phase === 'address') {
      const address = responses.address;
      if (!address) throw new Error('Missing response for "address"');
      if (address.action !== 'accept')
        return { kind: 'completed', value: { status: 'declined', writes: journal.writes } };
      return {
        kind: 'input_required',
        result: inputRequired({
          inputRequests: {
            confirm: inputRequired.elicit({
              message: 'Confirm booking?',
              requestedSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
            }),
          },
          requestState: await codec.mint({
            phase: 'confirm',
            opKey,
            address: (address.content as { address: string }).address,
          }),
        }),
      };
    }
    const confirm = responses.confirm;
    if (!confirm) throw new Error('Missing response for "confirm"');
    if (confirm.action !== 'accept' || !(confirm.content as { ok: boolean }).ok) {
      return { kind: 'completed', value: { status: 'cancelled', writes: journal.writes } };
    }
    if (!journal.bookings.has(state.opKey)) {
      journal.bookings.set(state.opKey, state.address);
      journal.writes += 1;
    }
    await request.log('info', { message: `booked ${opKey}` });
    return { kind: 'completed', value: { status: 'booked', address: state.address, writes: journal.writes } };
  },
});

export function makeServer(): MCPServer {
  return new MCPServer({
    name: 'packed-v2',
    version: '2.0.0',
    tools: { echo, bookDelivery },
    requestState: { verify: (state, ctx) => codec.verify(state, ctx) },
  });
}
