import { createMCPTool } from '@mastra/core/mcp';
import type { MCPRequestContextV2 } from '@mastra/core/mcp';
import { LOG_LEVEL_META_KEY, ProtocolError } from '@modelcontextprotocol/client';
import type { Client } from '@modelcontextprotocol/client';
import { createRequestStateCodec, inputRequired } from '@modelcontextprotocol/server';
import type { AuthInfo, ElicitResult, InputRequiredResult } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectModern, serveHTTP, textOf } from './__tests__/harness';
import type { ServedHTTP } from './__tests__/harness';
import { MCPServer } from './server';
import type { MCPServerConfig } from './types';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * Application-owned continuation state. Every round names its phase explicitly;
 * the framework never replays earlier stages, and the tool re-checks the
 * principal each round because a signature is not authorization.
 */
type BookingState =
  | { phase: 'address'; opKey: string; principal: string }
  | { phase: 'confirm'; opKey: string; principal: string; address: string };

const SECRET = 's'.repeat(32);
const codec = createRequestStateCodec<BookingState>({ key: SECRET });

const addressRequest = inputRequired.elicit({
  message: 'Delivery address?',
  requestedSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] },
});
const noteRequest = inputRequired.elicit({
  message: 'Delivery note?',
  requestedSchema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
});
const confirmRequest = inputRequired.elicit({
  message: 'Confirm booking?',
  requestedSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
});

interface Journal {
  bookings: Map<string, { address: string; note?: string }>;
  writes: number;
  rounds: Array<{ phase: string; responseKeys: string[] }>;
}

const newJournal = (): Journal => ({ bookings: new Map(), writes: 0, rounds: [] });

function principalOf(request: MCPRequestContextV2, requestContext: { get(key: string): unknown }): string {
  return (requestContext.get('authInfo') as AuthInfo | undefined)?.clientId ?? 'anonymous';
}

function makeServer(journal: Journal, config: Partial<MCPServerConfig> = {}) {
  const bookDelivery = createMCPTool({
    id: 'bookDelivery',
    description: 'Books a delivery after collecting an address and a confirmation',
    inputSchema: z.object({ opKey: z.string() }),
    outputSchema: z.object({ status: z.string(), address: z.string().optional(), writes: z.number() }),
    execute: async ({ opKey }, { request, requestContext }) => {
      const principal = principalOf(request, requestContext);
      const state = request.requestState as BookingState | undefined;
      const responses = request.inputResponses ?? {};
      journal.rounds.push({ phase: state?.phase ?? 'start', responseKeys: Object.keys(responses) });

      if (!state) {
        await request.log('info', { message: `start ${opKey}` });
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: { address: addressRequest, note: noteRequest },
            requestState: await codec.mint({ phase: 'address', opKey, principal }),
          }),
        };
      }
      if (state.principal !== principal) throw new Error('Continuation belongs to a different principal');
      if (state.opKey !== opKey) throw new Error('Continuation belongs to a different operation');

      if (state.phase === 'address') {
        const address = responses.address;
        if (!address) throw new Error('Missing response for "address"');
        if (address.action !== 'accept')
          return { kind: 'completed', value: { status: 'declined', writes: journal.writes } };
        await request.log('info', { message: `address ${opKey}` });
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: { confirm: confirmRequest },
            requestState: await codec.mint({
              phase: 'confirm',
              opKey,
              principal,
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
      // Domain-owned idempotency: the operation key, not the round, decides whether to write.
      if (!journal.bookings.has(state.opKey)) {
        journal.bookings.set(state.opKey, { address: state.address });
        journal.writes += 1;
      }
      return { kind: 'completed', value: { status: 'booked', address: state.address, writes: journal.writes } };
    },
  });

  const slowTool = createMCPTool({
    id: 'slowTool',
    description: 'Waits until cancelled',
    inputSchema: z.object({}),
    outputSchema: z.string(),
    execute: async (_input, { request }) => {
      await new Promise<void>(resolve => {
        request.signal.addEventListener('abort', () => resolve(), { once: true });
        setTimeout(resolve, 5_000).unref();
      });
      journal.rounds.push({ phase: request.signal.aborted ? 'aborted' : 'timed-out', responseKeys: [] });
      return { kind: 'completed', value: request.signal.aborted ? 'aborted' : 'timed-out' };
    },
  });

  return new MCPServer({
    name: 'Native Input Server',
    version: '1.0.0',
    tools: { bookDelivery, slowTool },
    requestState: { verify: codec.verify },
    resources: {
      listResources: async () => [{ uri: 'ticket://1', name: 'Ticket' }],
      getResourceContent: async ({ uri, request }) => {
        const confirm = request.inputResponses?.confirm;
        if (confirm?.action === 'accept')
          return { text: `ticket ${uri} for ${(confirm.content as { who: string }).who}` };
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: {
              confirm: inputRequired.elicit({
                message: 'Who is reading?',
                requestedSchema: { type: 'object', properties: { who: { type: 'string' } }, required: ['who'] },
              }),
            },
          }),
        };
      },
    },
    prompts: {
      listPrompts: async () => [{ name: 'brief' }],
      getPromptMessages: async ({ request }) => {
        const topic = request.inputResponses?.topic;
        if (topic?.action === 'accept') {
          return [
            { role: 'user', content: { type: 'text', text: `brief on ${(topic.content as { topic: string }).topic}` } },
          ];
        }
        return {
          kind: 'input_required',
          result: inputRequired({
            inputRequests: {
              topic: inputRequired.elicit({
                message: 'Topic?',
                requestedSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] },
              }),
            },
          }),
        };
      },
    },
    ...config,
  });
}

const accept = (content: Record<string, unknown>): ElicitResult => ({ action: 'accept', content });
const decline: ElicitResult = { action: 'decline' };

type Round = InputRequiredResult;
const asRound = (value: unknown): Round => {
  const round = value as Round;
  expect(round.resultType).toBe('input_required');
  return round;
};

async function callRound(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  continuation?: { inputResponses?: Record<string, ElicitResult>; requestState?: string },
  meta?: Record<string, unknown>,
) {
  return client.callTool(
    { name, arguments: args, ...continuation, ...(meta ? { _meta: meta } : {}) },
    { allowInputRequired: true },
  );
}

const manual = { inputRequired: { autoFulfill: false }, capabilities: { elicitation: { form: {} } } } as const;
const clientAuth = (clientId: string): AuthInfo => ({ token: `${clientId}-token`, clientId, scopes: [] });

describe('native input_required continuation', () => {
  let journal: Journal;
  let server: MCPServer;
  let served: ServedHTTP;

  beforeAll(async () => {
    journal = newJournal();
    server = makeServer(journal);
    served = await serveHTTP(server, { auth: req => clientAuth(String(req.headers['x-test-client'] ?? 'client-a')) });
  });

  afterAll(async () => {
    await served.close();
  });

  beforeEach(() => {
    journal.bookings.clear();
    journal.writes = 0;
    journal.rounds.length = 0;
  });

  it('runs two keyed rounds with named phases, per-round responses and one counted write', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-1' }));
      expect(Object.keys(first.inputRequests!)).toEqual(['address', 'note']);
      expect(first.inputRequests!.address).toEqual(addressRequest);
      expect(typeof first.requestState).toBe('string');

      const second = asRound(
        await callRound(
          client,
          'bookDelivery',
          { opKey: 'op-1' },
          {
            inputResponses: { address: accept({ address: '1 Main St' }), note: accept({ note: 'ring twice' }) },
            requestState: first.requestState,
          },
        ),
      );
      expect(Object.keys(second.inputRequests!)).toEqual(['confirm']);
      expect(second.requestState).not.toBe(first.requestState);

      const done = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-1' },
        {
          inputResponses: { confirm: accept({ ok: true }) },
          requestState: second.requestState,
        },
      );
      expect(done.structuredContent).toEqual({ status: 'booked', address: '1 Main St', writes: 1 });
      expect(journal.rounds).toEqual([
        { phase: 'start', responseKeys: [] },
        { phase: 'address', responseKeys: ['address', 'note'] },
        { phase: 'confirm', responseKeys: ['confirm'] },
      ]);

      // Replaying the final round is idempotent through the domain operation key.
      const again = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-1' },
        {
          inputResponses: { confirm: accept({ ok: true }) },
          requestState: second.requestState,
        },
      );
      expect(again.structuredContent).toEqual({ status: 'booked', address: '1 Main St', writes: 1 });
      expect(journal.writes).toBe(1);
    } finally {
      await client.close();
    }
  });

  it('completes the same flow through the SDK auto-fulfilment driver without any server push', async () => {
    const answers: Record<string, ElicitResult> = {
      'Delivery address?': accept({ address: '2 Side St' }),
      'Delivery note?': accept({ note: 'leave at door' }),
      'Confirm booking?': accept({ ok: true }),
    };
    const client = await connectModern(served.url, { capabilities: { elicitation: { form: {} } } });
    const seen: string[] = [];
    client.setRequestHandler('elicitation/create', async request => {
      seen.push(request.params.message);
      return answers[request.params.message]!;
    });
    try {
      const result = await client.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-auto' } });
      expect(result.structuredContent).toEqual({ status: 'booked', address: '2 Side St', writes: 1 });
      expect(seen).toEqual(['Delivery address?', 'Delivery note?', 'Confirm booking?']);
    } finally {
      await client.close();
    }
  });

  it('honours declines and cancellations without writing', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-decline' }));
      const declined = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-decline' },
        {
          inputResponses: { address: decline, note: decline },
          requestState: first.requestState,
        },
      );
      expect(declined.structuredContent).toEqual({ status: 'declined', writes: 0 });

      const again = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-cancel' }));
      const second = asRound(
        await callRound(
          client,
          'bookDelivery',
          { opKey: 'op-cancel' },
          {
            inputResponses: { address: accept({ address: '3 Back St' }), note: decline },
            requestState: again.requestState,
          },
        ),
      );
      const cancelled = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-cancel' },
        {
          inputResponses: { confirm: { action: 'cancel' } },
          requestState: second.requestState,
        },
      );
      expect(cancelled.structuredContent).toEqual({ status: 'cancelled', writes: 0 });
      expect(journal.writes).toBe(0);
    } finally {
      await client.close();
    }
  });

  it('rejects malformed, mismatched and missing responses', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-bad' }));
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-bad' },
          {
            inputResponses: { address: { garbage: true } as unknown as ElicitResult },
            requestState: first.requestState,
          },
        ),
      ).rejects.toThrow(new ProtocolError(-32602, 'Unsupported input response for "address"'));

      const mismatched = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-bad' },
        {
          inputResponses: { confirm: accept({ ok: true }) },
          requestState: first.requestState,
        },
      );
      expect(mismatched.isError).toBe(true);
      expect(textOf(mismatched)).toContain('Missing response for "address"');

      const otherOperation = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-other' },
        {
          inputResponses: { address: accept({ address: 'x' }) },
          requestState: first.requestState,
        },
      );
      expect(otherOperation.isError).toBe(true);
      expect(textOf(otherOperation)).toContain('different operation');
      expect(journal.writes).toBe(0);
    } finally {
      await client.close();
    }
  });

  it('rejects tampered, foreign and expired request state before any handler runs', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-state' }));
      const rounds = journal.rounds.length;
      const tampered = `${first.requestState!.slice(0, -4)}AAAA`;
      for (const requestState of [tampered, 'not-a-state']) {
        await expect(
          callRound(
            client,
            'bookDelivery',
            { opKey: 'op-state' },
            {
              inputResponses: { address: accept({ address: 'x' }) },
              requestState,
            },
          ),
        ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      }
      const foreign = createRequestStateCodec<BookingState>({ key: 'o'.repeat(32) });
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-state' },
          {
            inputResponses: { address: accept({ address: 'x' }) },
            requestState: await foreign.mint({ phase: 'address', opKey: 'op-state', principal: 'client-a' }),
          },
        ),
      ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      const expiring = createRequestStateCodec<BookingState>({ key: SECRET, ttlSeconds: 1 });
      const expired = await expiring.mint({ phase: 'address', opKey: 'op-state', principal: 'client-a' });
      await new Promise(resolve => setTimeout(resolve, 2_100));
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-state' },
          {
            inputResponses: { address: accept({ address: 'x' }) },
            requestState: expired,
          },
        ),
      ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      expect(journal.rounds).toHaveLength(rounds);
    } finally {
      await client.close();
    }
  });

  it('re-authorizes every round and refuses continuation by a different principal', async () => {
    const clientA = await connectModern(served.url, manual);
    // The transport identity is derived per request; the header selects the test principal.
    const clientB = await connectModern(served.url, manual, { 'x-test-client': 'client-b' });
    try {
      const first = asRound(await callRound(clientA, 'bookDelivery', { opKey: 'op-principal' }));
      const stolen = await callRound(
        clientB,
        'bookDelivery',
        { opKey: 'op-principal' },
        {
          inputResponses: { address: accept({ address: 'x' }) },
          requestState: first.requestState,
        },
      );
      expect(stolen.isError).toBe(true);
      expect(textOf(stolen)).toContain('different principal');
      const own = asRound(
        await callRound(
          clientA,
          'bookDelivery',
          { opKey: 'op-principal' },
          {
            inputResponses: { address: accept({ address: 'x' }) },
            requestState: first.requestState,
          },
        ),
      );
      expect(Object.keys(own.inputRequests!)).toEqual(['confirm']);
      expect(journal.writes).toBe(0);
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });

  it('continues a round on a different server instance sharing the codec', async () => {
    const otherJournal = newJournal();
    const other = await serveHTTP(makeServer(otherJournal), { auth: clientAuth('client-a') });
    try {
      const clientA = await connectModern(served.url, manual);
      const clientB = await connectModern(other.url, manual);
      try {
        const first = asRound(await callRound(clientA, 'bookDelivery', { opKey: 'op-cross' }));
        const second = asRound(
          await callRound(
            clientB,
            'bookDelivery',
            { opKey: 'op-cross' },
            {
              inputResponses: { address: accept({ address: '4 Cross St' }) },
              requestState: first.requestState,
            },
          ),
        );
        const done = await callRound(
          clientB,
          'bookDelivery',
          { opKey: 'op-cross' },
          {
            inputResponses: { confirm: accept({ ok: true }) },
            requestState: second.requestState,
          },
        );
        expect(done.structuredContent).toEqual({ status: 'booked', address: '4 Cross St', writes: 1 });
        expect(journal.writes).toBe(0);
        expect(otherJournal.writes).toBe(1);
      } finally {
        await clientA.close();
        await clientB.close();
      }
    } finally {
      await other.close();
    }
  });

  it('cancels the handler when the client abandons the request', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const controller = new AbortController();
      const call = client.callTool({ name: 'slowTool', arguments: {} }, { signal: controller.signal });
      await new Promise(resolve => setTimeout(resolve, 200));
      controller.abort();
      await expect(call).rejects.toThrow();
      await vi.waitFor(() => expect(journal.rounds).toEqual([{ phase: 'aborted', responseKeys: [] }]), 5_000);
    } finally {
      await client.close();
    }
  });

  it('scopes per-request logging to each round', async () => {
    const client = await connectModern(served.url, manual);
    const logs: unknown[] = [];
    client.setNotificationHandler('notifications/message', async n => {
      logs.push(n.params.data);
    });
    try {
      const first = asRound(
        await callRound(client, 'bookDelivery', { opKey: 'op-log' }, undefined, { [LOG_LEVEL_META_KEY]: 'info' }),
      );
      expect(logs).toEqual([{ message: 'start op-log' }]);
      logs.length = 0;
      asRound(
        await callRound(
          client,
          'bookDelivery',
          { opKey: 'op-log' },
          {
            inputResponses: { address: accept({ address: 'x' }) },
            requestState: first.requestState,
          },
        ),
      );
      expect(logs).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('supports native continuation for resources/read and prompts/get', async () => {
    const client = await connectModern(served.url, manual);
    try {
      const resourceRound = asRound(await client.readResource({ uri: 'ticket://1' }, { allowInputRequired: true }));
      expect(Object.keys(resourceRound.inputRequests!)).toEqual(['confirm']);
      const resource = await client.readResource(
        { uri: 'ticket://1', inputResponses: { confirm: accept({ who: 'Ada' }) } },
        { allowInputRequired: true },
      );
      expect(resource.contents[0]).toMatchObject({ uri: 'ticket://1', text: 'ticket ticket://1 for Ada' });

      const promptRound = asRound(await client.getPrompt({ name: 'brief' }, { allowInputRequired: true }));
      expect(Object.keys(promptRound.inputRequests!)).toEqual(['topic']);
      const prompt = await client.getPrompt(
        { name: 'brief', inputResponses: { topic: accept({ topic: 'MCP' }) } },
        { allowInputRequired: true },
      );
      expect(prompt.messages[0]?.content).toEqual({ type: 'text', text: 'brief on MCP' });
    } finally {
      await client.close();
    }
  });

  it('surfaces input_required as a typed failure when a client cannot answer', async () => {
    const client = await connectModern(served.url, manual);
    try {
      await expect(client.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-manual' } })).rejects.toThrow(
        /input_required/,
      );
    } finally {
      await client.close();
    }
    const noHandler = await connectModern(served.url);
    try {
      await expect(noHandler.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-nohandler' } })).rejects.toThrow(
        /elicitation\/create/,
      );
    } finally {
      await noHandler.close();
    }
    expect(journal.writes).toBe(0);
  });
});
