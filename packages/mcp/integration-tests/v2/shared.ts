import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';

/** Shared signing key: any instance holding it can resume a round another instance started. */
export const REQUEST_STATE_KEY = 'packed-consumer-proof-key-0123456789abcdef';

export const journal = { bookings: new Map<string, string>(), writes: 0 };

/** Ordinary tool: reusable by agents and workflows; reports what `context.mcp` looks like on a 2.x server. */
export const echo = createTool({
  id: 'echo',
  description: 'Echo a message',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ echoed: z.string(), protocolVersion: z.string(), deprecatedElicitationThrows: z.boolean() }),
  execute: async ({ message }, context) => {
    let deprecatedElicitationThrows = false;
    try {
      // 2026-07-28 removed server-initiated elicitation; the unified context keeps the member but it throws.
      await context.mcp?.elicitation.sendRequest({ message: 'x', requestedSchema: { type: 'object', properties: {} } });
    } catch {
      deprecatedElicitationThrows = true;
    }
    return { echoed: message, protocolVersion: context.mcp?.protocolVersion ?? 'none', deprecatedElicitationThrows };
  },
});

/** Suspends for an address, then for a confirmation, then performs one counted booking write. */
export const bookDelivery = createTool({
  id: 'bookDelivery',
  description: 'Books a delivery after collecting an address and a confirmation',
  inputSchema: z.object({ opKey: z.string() }),
  outputSchema: z.object({ status: z.string(), address: z.string().optional(), writes: z.number() }),
  suspendSchema: z.object({
    phase: z.enum(['address', 'confirm']),
    message: z.string(),
    address: z.string().optional(),
  }),
  resumeSchema: z.object({ address: z.string().optional(), ok: z.boolean().optional() }),
  execute: async ({ opKey }, context) => {
    if (!context.resumeData) {
      await context.mcp?.log?.('info', `start ${opKey}`);
      await context.suspend?.({ phase: 'address', message: 'Delivery address?' });
      return;
    }
    if (context.suspendPayload?.phase === 'address') {
      if (!context.resumeData.address) return { status: 'declined', writes: journal.writes };
      await context.suspend?.({ phase: 'confirm', message: 'Confirm booking?', address: context.resumeData.address });
      return;
    }
    if (!context.resumeData.ok) return { status: 'cancelled', writes: journal.writes };
    const address = context.suspendPayload!.address!;
    // Domain-owned idempotency: the operation key decides whether to write, not the round.
    if (!journal.bookings.has(opKey)) {
      journal.bookings.set(opKey, address);
      journal.writes += 1;
    }
    await context.mcp?.log?.('info', `booked ${opKey}`);
    return { status: 'booked', address, writes: journal.writes };
  },
});

export function makeServer(): MCPServer {
  return new MCPServer({
    name: 'packed-v2',
    version: '2.0.0',
    tools: { echo, bookDelivery },
    requestState: { key: REQUEST_STATE_KEY },
  });
}
