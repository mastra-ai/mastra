import type http from 'node:http';
import { createTool } from '@mastra/core/tools';
import { LOG_LEVEL_META_KEY } from '@modelcontextprotocol/client';
import type { Client } from '@modelcontextprotocol/client';
import { createRequestStateCodec } from '@modelcontextprotocol/server';
import type { AuthInfo, ElicitResult, InputRequiredResult } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectClient, serveHTTP, textOf } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const SECRET = 's'.repeat(32);

interface Journal {
  bookings: Map<string, { address: string }>;
  writes: number;
  rounds: Array<{ phase: string; resumeKeys: string[] }>;
}

const newJournal = (): Journal => ({ bookings: new Map(), writes: 0, rounds: [] });

/**
 * A tool that suspends twice before writing once. Every suspension names its
 * phase; the framework hands the payload back untouched and never replays an
 * earlier round.
 */
function makeServer(journal: Journal, config: Partial<MCPServerConfig> = {}) {
  const bookDelivery = createTool({
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
      const phase = context.suspendPayload?.phase ?? 'start';
      journal.rounds.push({ phase, resumeKeys: Object.keys(context.resumeData ?? {}) });

      if (!context.resumeData) {
        await context.mcp?.log?.('info', `start ${opKey}`);
        await context.suspend?.({ phase: 'address', message: 'Delivery address?' });
        return;
      }
      if (phase === 'address') {
        if (!context.resumeData.address) throw new Error('Missing address');
        await context.mcp?.log?.('info', `address ${opKey}`);
        await context.suspend?.({ phase: 'confirm', message: 'Confirm booking?', address: context.resumeData.address });
        return;
      }
      if (!context.resumeData.ok) return { status: 'not confirmed', writes: journal.writes };
      const address = context.suspendPayload!.address!;
      // Domain-owned idempotency: the operation key, not the round, decides whether to write.
      if (!journal.bookings.has(opKey)) {
        journal.bookings.set(opKey, { address });
        journal.writes += 1;
      }
      return { status: 'booked', address, writes: journal.writes };
    },
  });

  const slowTool = createTool({
    id: 'slowTool',
    description: 'Waits until cancelled',
    inputSchema: z.object({}),
    outputSchema: z.string(),
    execute: async (_input, context) => {
      const signal = context.mcp!.extra.signal;
      await new Promise<void>(resolve => {
        signal.addEventListener('abort', () => resolve(), { once: true });
        setTimeout(resolve, 5_000).unref();
      });
      journal.rounds.push({ phase: signal.aborted ? 'aborted' : 'timed-out', resumeKeys: [] });
      return signal.aborted ? 'aborted' : 'timed-out';
    },
  });

  return new MCPServer({
    name: 'Native Input Server',
    version: '1.0.0',
    tools: { bookDelivery, slowTool },
    requestState: { key: SECRET },
    resources: {
      listResources: async () => [{ uri: 'ticket://1', name: 'Ticket' }],
      resumeSchema: z.object({ who: z.string() }),
      getResourceContent: async ({ uri, suspend, resumeData }) => {
        if (!resumeData) return suspend({ message: 'Who is reading?' });
        return { text: `ticket ${uri} for ${(resumeData as { who: string }).who}` };
      },
    },
    prompts: {
      listPrompts: async () => [{ name: 'brief' }],
      resumeSchema: z.object({ topic: z.string() }),
      getPromptMessages: async ({ suspend, resumeData }) => {
        if (!resumeData) return suspend({ message: 'Topic?' });
        return [
          { role: 'user', content: { type: 'text', text: `brief on ${(resumeData as { topic: string }).topic}` } },
        ];
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
  expect(Object.keys(round.inputRequests!)).toEqual(['input']);
  return round;
};
const messageOf = (round: Round) => (round.inputRequests!.input!.params as { message: string }).message;

async function callRound(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  continuation?: { answer?: ElicitResult; requestState?: string },
  meta?: Record<string, unknown>,
) {
  return client.callTool(
    {
      name,
      arguments: args,
      ...(continuation?.answer ? { inputResponses: { input: continuation.answer } } : {}),
      ...(continuation?.requestState ? { requestState: continuation.requestState } : {}),
      ...(meta ? { _meta: meta } : {}),
    },
    { allowInputRequired: true },
  );
}

const manual = { inputRequired: { autoFulfill: false }, capabilities: { elicitation: { form: {} } } } as const;
const clientAuth = (clientId: string): AuthInfo => ({ token: `${clientId}-token`, clientId, scopes: [] });

describe('input_required continuation through suspend/resume', () => {
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

  it('runs two rounds with named phases, the resumeSchema form and one counted write', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-1' }));
      expect(first.inputRequests!.input).toEqual({
        method: 'elicitation/create',
        params: {
          mode: 'form',
          message: 'Delivery address?',
          requestedSchema: {
            type: 'object',
            properties: { address: { type: 'string' }, ok: { type: 'boolean' } },
            additionalProperties: false,
          },
        },
      });
      expect(typeof first.requestState).toBe('string');

      const second = asRound(
        await callRound(
          client,
          'bookDelivery',
          { opKey: 'op-1' },
          { answer: accept({ address: '1 Main St' }), requestState: first.requestState },
        ),
      );
      expect(messageOf(second)).toBe('Confirm booking?');
      expect(second.requestState).not.toBe(first.requestState);

      const done = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-1' },
        { answer: accept({ ok: true }), requestState: second.requestState },
      );
      expect(done.structuredContent).toEqual({ status: 'booked', address: '1 Main St', writes: 1 });
      expect(journal.rounds).toEqual([
        { phase: 'start', resumeKeys: [] },
        { phase: 'address', resumeKeys: ['address'] },
        { phase: 'confirm', resumeKeys: ['ok'] },
      ]);

      // Replaying the final round is idempotent through the domain operation key.
      const again = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-1' },
        { answer: accept({ ok: true }), requestState: second.requestState },
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
      'Confirm booking?': accept({ ok: true }),
    };
    const client = await connectClient(served.url, { capabilities: { elicitation: { form: {} } } });
    const seen: string[] = [];
    client.setRequestHandler('elicitation/create', async request => {
      seen.push(request.params.message);
      return answers[request.params.message]!;
    });
    try {
      const result = await client.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-auto' } });
      expect(result.structuredContent).toEqual({ status: 'booked', address: '2 Side St', writes: 1 });
      expect(seen).toEqual(['Delivery address?', 'Confirm booking?']);
    } finally {
      await client.close();
    }
  });

  it('ends the request on decline or cancel without running the handler', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-decline' }));
      const declined = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-decline' },
        { answer: decline, requestState: first.requestState },
      );
      expect(declined.isError).toBe(true);
      expect(textOf(declined)).toBe("Tool 'bookDelivery' was declined");

      const again = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-cancel' }));
      const cancelled = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-cancel' },
        { answer: { action: 'cancel' }, requestState: again.requestState },
      );
      expect(cancelled.isError).toBe(true);
      expect(textOf(cancelled)).toBe("Tool 'bookDelivery' was cancelled");

      // The answer of the previous round is not replayed: the tool never ran again.
      expect(journal.rounds).toEqual([
        { phase: 'start', resumeKeys: [] },
        { phase: 'start', resumeKeys: [] },
      ]);
      expect(journal.writes).toBe(0);
    } finally {
      await client.close();
    }
  });

  it('rejects malformed, mismatched and missing answers', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-bad' }));

      // An answer that does not match the resumeSchema never reaches the tool.
      const invalid = await callRound(
        client,
        'bookDelivery',
        { opKey: 'op-bad' },
        { answer: accept({ address: 42 }), requestState: first.requestState },
      );
      expect(invalid.isError).toBe(true);
      expect(textOf(invalid)).toContain('address');

      // A request state without an answer is a malformed continuation.
      await expect(
        callRound(client, 'bookDelivery', { opKey: 'op-bad' }, { requestState: first.requestState }),
      ).rejects.toMatchObject({ code: -32602, message: 'Missing input response "input"' });

      // A request state issued for other arguments cannot answer this call.
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-other' },
          { answer: accept({ address: 'x' }), requestState: first.requestState },
        ),
      ).rejects.toMatchObject({
        code: -32602,
        message: 'requestState does not belong to tools/call "bookDelivery" with these arguments',
      });

      expect(journal.rounds).toEqual([{ phase: 'start', resumeKeys: [] }]);
      expect(journal.writes).toBe(0);
    } finally {
      await client.close();
    }
  });

  it('rejects tampered, foreign and expired request state before any handler runs', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const first = asRound(await callRound(client, 'bookDelivery', { opKey: 'op-state' }));
      const rounds = journal.rounds.length;
      const tampered = `${first.requestState!.slice(0, -4)}AAAA`;
      for (const requestState of [tampered, 'not-a-state']) {
        await expect(
          callRound(client, 'bookDelivery', { opKey: 'op-state' }, { answer: accept({ address: 'x' }), requestState }),
        ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      }
      const foreign = createRequestStateCodec({ key: 'o'.repeat(32) });
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-state' },
          { answer: accept({ address: 'x' }), requestState: await foreign.mint({ phase: 'address' }) },
        ),
      ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      const expiring = createRequestStateCodec({ key: SECRET, ttlSeconds: 1 });
      const expired = await expiring.mint({ phase: 'address' });
      await new Promise(resolve => setTimeout(resolve, 2_100));
      await expect(
        callRound(
          client,
          'bookDelivery',
          { opKey: 'op-state' },
          { answer: accept({ address: 'x' }), requestState: expired },
        ),
      ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      expect(journal.rounds).toHaveLength(rounds);
    } finally {
      await client.close();
    }
  });

  it('re-authorizes every round and refuses continuation by a different caller', async () => {
    const clientA = await connectClient(served.url, manual);
    // The transport identity is derived per request; the header selects the test principal.
    const clientB = await connectClient(served.url, manual, { 'x-test-client': 'client-b' });
    try {
      const first = asRound(await callRound(clientA, 'bookDelivery', { opKey: 'op-principal' }));
      await expect(
        callRound(
          clientB,
          'bookDelivery',
          { opKey: 'op-principal' },
          { answer: accept({ address: 'x' }), requestState: first.requestState },
        ),
      ).rejects.toMatchObject({ code: -32602, message: 'requestState was issued to a different caller' });
      const own = asRound(
        await callRound(
          clientA,
          'bookDelivery',
          { opKey: 'op-principal' },
          { answer: accept({ address: 'x' }), requestState: first.requestState },
        ),
      );
      expect(messageOf(own)).toBe('Confirm booking?');
      expect(journal.writes).toBe(0);
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });

  describe('users sharing one OAuth client', () => {
    // Every request presents the same clientId; only the bearer token differs.
    const sharedClientAuth = (req: http.IncomingMessage): AuthInfo => ({
      token: String(req.headers['x-test-user'] ?? 'user-a'),
      clientId: 'shared-client',
      scopes: [],
    });

    async function expectUserIsolation(served: ServedHTTP, journalOf: Journal) {
      const userA = await connectClient(served.url, manual, { 'x-test-user': 'user-a' });
      const userB = await connectClient(served.url, manual, { 'x-test-user': 'user-b' });
      try {
        const first = asRound(await callRound(userA, 'bookDelivery', { opKey: 'op-shared' }));
        await expect(
          callRound(
            userB,
            'bookDelivery',
            { opKey: 'op-shared' },
            { answer: accept({ address: 'x' }), requestState: first.requestState },
          ),
        ).rejects.toMatchObject({ code: -32602, message: 'requestState was issued to a different caller' });
        const own = asRound(
          await callRound(
            userA,
            'bookDelivery',
            { opKey: 'op-shared' },
            { answer: accept({ address: 'x' }), requestState: first.requestState },
          ),
        );
        expect(messageOf(own)).toBe('Confirm booking?');
        expect(journalOf.writes).toBe(0);
      } finally {
        await userA.close();
        await userB.close();
      }
    }

    it('binds the continuation to the mapped user', async () => {
      const otherJournal = newJournal();
      const other = await serveHTTP(
        makeServer(otherJournal, {
          mapAuthInfoToUser: ({ authInfo }) => ({ id: (authInfo as AuthInfo).token }),
        }),
        { auth: sharedClientAuth },
      );
      try {
        await expectUserIsolation(other, otherJournal);
      } finally {
        await other.close();
      }
    });

    it('binds the continuation to the bearer token when no subject or user is known', async () => {
      const otherJournal = newJournal();
      const other = await serveHTTP(makeServer(otherJournal), { auth: sharedClientAuth });
      try {
        await expectUserIsolation(other, otherJournal);
      } finally {
        await other.close();
      }
    });
  });

  it('continues a round on a different server instance sharing the key', async () => {
    const otherJournal = newJournal();
    const other = await serveHTTP(makeServer(otherJournal), { auth: () => clientAuth('client-a') });
    try {
      const clientA = await connectClient(served.url, manual);
      const clientB = await connectClient(other.url, manual);
      try {
        const first = asRound(await callRound(clientA, 'bookDelivery', { opKey: 'op-cross' }));
        const second = asRound(
          await callRound(
            clientB,
            'bookDelivery',
            { opKey: 'op-cross' },
            { answer: accept({ address: '4 Cross St' }), requestState: first.requestState },
          ),
        );
        const done = await callRound(
          clientB,
          'bookDelivery',
          { opKey: 'op-cross' },
          { answer: accept({ ok: true }), requestState: second.requestState },
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

  it('refuses continuation from a server without a shared key', async () => {
    const otherJournal = newJournal();
    const other = await serveHTTP(makeServer(otherJournal, { requestState: undefined }), {
      auth: () => clientAuth('client-a'),
    });
    try {
      const clientA = await connectClient(served.url, manual);
      const clientB = await connectClient(other.url, manual);
      try {
        const first = asRound(await callRound(clientA, 'bookDelivery', { opKey: 'op-unkeyed' }));
        await expect(
          callRound(
            clientB,
            'bookDelivery',
            { opKey: 'op-unkeyed' },
            { answer: accept({ address: 'x' }), requestState: first.requestState },
          ),
        ).rejects.toMatchObject({ code: -32602, message: 'Invalid or expired requestState' });
      } finally {
        await clientA.close();
        await clientB.close();
      }
    } finally {
      await other.close();
    }
  });

  it('cancels the handler when the client abandons the request', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const controller = new AbortController();
      const call = client.callTool({ name: 'slowTool', arguments: {} }, { signal: controller.signal });
      await new Promise(resolve => setTimeout(resolve, 200));
      controller.abort();
      await expect(call).rejects.toThrow();
      await vi.waitFor(() => expect(journal.rounds).toEqual([{ phase: 'aborted', resumeKeys: [] }]), 5_000);
    } finally {
      await client.close();
    }
  });

  it('scopes per-request logging to each round', async () => {
    const client = await connectClient(served.url, manual);
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
      // The next round did not opt in: its log line is not delivered.
      asRound(
        await callRound(
          client,
          'bookDelivery',
          { opKey: 'op-log' },
          { answer: accept({ address: 'x' }), requestState: first.requestState },
        ),
      );
      expect(logs).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('suspends and resumes resources/read and prompts/get the same way', async () => {
    const client = await connectClient(served.url, manual);
    try {
      const resourceRound = asRound(await client.readResource({ uri: 'ticket://1' }, { allowInputRequired: true }));
      expect(messageOf(resourceRound)).toBe('Who is reading?');
      const resource = await client.readResource(
        {
          uri: 'ticket://1',
          inputResponses: { input: accept({ who: 'Ada' }) },
          requestState: resourceRound.requestState,
        },
        { allowInputRequired: true },
      );
      expect(resource.contents[0]).toMatchObject({ uri: 'ticket://1', text: 'ticket ticket://1 for Ada' });
      await expect(
        client.readResource(
          {
            uri: 'ticket://1',
            inputResponses: { input: accept({ who: 1 }) },
            requestState: resourceRound.requestState,
          },
          { allowInputRequired: true },
        ),
      ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('resumeSchema') });

      const promptRound = asRound(await client.getPrompt({ name: 'brief' }, { allowInputRequired: true }));
      expect(messageOf(promptRound)).toBe('Topic?');
      const prompt = await client.getPrompt(
        { name: 'brief', inputResponses: { input: accept({ topic: 'MCP' }) }, requestState: promptRound.requestState },
        { allowInputRequired: true },
      );
      expect(prompt.messages[0]?.content).toEqual({ type: 'text', text: 'brief on MCP' });
    } finally {
      await client.close();
    }
  });

  it('surfaces input_required as a typed failure when a client cannot answer', async () => {
    const client = await connectClient(served.url, manual);
    try {
      await expect(client.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-manual' } })).rejects.toThrow(
        /input_required/,
      );
    } finally {
      await client.close();
    }
    const noHandler = await connectClient(served.url);
    try {
      await expect(noHandler.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-nohandler' } })).rejects.toThrow(
        /elicitation\/create/,
      );
    } finally {
      await noHandler.close();
    }
    expect(journal.writes).toBe(0);
  });

  it('refuses to register a tool whose resumeSchema cannot be presented as a form', () => {
    const nested = createTool({
      id: 'nested',
      description: 'Suspends into a nested answer',
      inputSchema: z.object({}),
      suspendSchema: z.object({}),
      resumeSchema: z.object({ address: z.object({ street: z.string() }) }),
      execute: async () => 'never',
    });
    expect(() => new MCPServer({ name: 'bad', version: '1.0.0', tools: { nested } })).toThrow(
      /resumeSchema of tool 'nested' cannot be presented as an input request/,
    );
  });
});
