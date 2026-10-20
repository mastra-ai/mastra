import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { initializeLogger, JobContext, JobProcess, runWithJobContextAsync, llm, voice } from '@livekit/agents';
import { Job, Room as RoomInfo } from '@livekit/protocol';
import { AudioSource, LocalAudioTrack, Room, RoomEvent, TrackPublishOptions, TrackSource } from '@livekit/rtc-node';
import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { noopObserve } from '@mastra/core/tools';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDtmfTool } from './dtmf';
import { MastraLLM } from './llm-plugin';
import { createLiveKitTranscriptPersistence } from './transcript';
import type { SessionStartArgs } from './worker';
import { createLiveKitWorker } from './worker';

// Native RTC and an actual local LiveKit server. Only the paid model and telephone
// provider boundaries are simulated; no SIP trunk is provisioned or dialed.
const url = process.env.LIVEKIT_TEST_ROOM_URL;
const apiKey = process.env.LIVEKIT_TEST_ROOM_API_KEY ?? 'devkey';
const secret = process.env.LIVEKIT_TEST_ROOM_API_SECRET ?? 'secret';
const cleanups: Array<() => Promise<unknown>> = [];
beforeAll(() => {
  initializeLogger({ level: 'silent', pretty: false });
  if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('LIVEKIT_TEST_ROOM_URL must point to a local test server');
  }
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(mode: 'local' | 'remote' | 'worker', preemptive = false, persist = false) {
  const name = `dtmf-${crypto.randomUUID()}`;
  const rooms = new RoomServiceClient(url!, apiKey, secret, { failover: false });
  await rooms.createRoom({ name });
  cleanups.push(() => rooms.deleteRoom(name).catch(() => {}));
  const connect = async (identity: string, kind: string) => {
    const room = new Room();
    cleanups.push(() => room.disconnect());
    const token = new AccessToken(apiKey, secret, { identity, ttl: '5m' });
    token.kind = kind;
    token.addGrant({ roomJoin: true, room: name, canPublish: true, canSubscribe: true });
    await room.connect(url!, await token.toJwt());
    // Real phone participants publish audio. Without a publication, the server batches
    // participant announcements, so early DTMF can arrive before its sender is known.
    const source = new AudioSource(8000, 1);
    const track = LocalAudioTrack.createAudioTrack('call-audio', source);
    cleanups.push(() => track.close(true));
    await room.localParticipant!.publishTrack(
      track,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );
    return room;
  };
  const caller = await connect('caller', 'sip');
  const room = await connect('worker', 'agent');
  await vi.waitFor(() => expect(room.remoteParticipants.has('caller')).toBe(true));
  await vi.waitFor(() => expect(caller.remoteParticipants.has('worker')).toBe(true));
  const packets: Array<{ code: number; digit: string }> = [];
  caller.on(RoomEvent.DtmfReceived, (code, digit) => packets.push({ code, digit }));

  const state = {
    digits: '12*#ABCD0',
    authorized: true,
    beforeModel: undefined as (() => Promise<void>) | undefined,
    prompts: [] as Array<Record<string, any>>,
    requests: [] as Request[],
  };
  const app = new Hono();
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      if (req.url?.startsWith('/model/')) {
        const prompt = JSON.parse(body.toString());
        state.prompts.push(prompt);
        await state.beforeModel?.();
        const hasResult = prompt.messages.some((message: { role: string }) => message.role === 'tool');
        const delta = hasResult
          ? { role: 'assistant', content: 'Listening.' }
          : {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'keypress',
                  type: 'function',
                  function: {
                    name: 'sendDtmf',
                    arguments: JSON.stringify({ digits: state.digits }),
                  },
                },
              ],
            };
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(
          `data: ${JSON.stringify({
            id: 'model-response',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'test',
            choices: [{ index: 0, delta, finish_reason: null }],
          })}\n\n`,
        );
        res.write(
          `data: ${JSON.stringify({
            id: 'model-response',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'test',
            choices: [{ index: 0, delta: {}, finish_reason: hasResult ? 'stop' : 'tool_calls' }],
          })}\n\n`,
        );
        res.end('data: [DONE]\n\n');
        return;
      }
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: body.length ? body : undefined,
      });
      state.requests.push(request.clone());
      const response = await app.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch (error) {
      res.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(
    () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const storage = new LibSQLStore({ id: crypto.randomUUID(), url: ':memory:' });
  cleanups.push(() => storage.close());
  const memory = new Memory({ storage, options: { semanticRecall: false, lastMessages: 20 } });
  const agent = new Agent({
    ...(persist && { memory }),
    id: 'navigator',
    name: 'Navigator',
    instructions: 'Use sendDtmf to navigate the menu.',
    model: { id: 'openai/gpt-4o-mini', url: `${baseUrl}/model`, apiKey: 'local-test', api: 'chat' },
  });
  const mastra = new Mastra({
    storage,
    agents: { navigator: agent },
    logger: false,
    server: {
      auth: {
        protected: ['/voice-api/*'],
        authenticateToken: async token => (state.authorized && token === 'test-token' ? { id: 'worker' } : null),
        authorize: async () => true,
      },
    },
  });
  await new MastraServer({ app, mastra, prefix: '/voice-api' }).init();
  let session: voice.AgentSession;
  const client = new MastraClient({
    baseUrl,
    apiPrefix: '/voice-api',
    retries: 0,
    headers: { Authorization: 'Bearer test-token' },
  });
  const persistence =
    persist && mode !== 'worker'
      ? await createLiveKitTranscriptPersistence({
          ...(mode === 'local' ? { agent } : { remote: { client, agentId: 'navigator' } }),
          sessionId: name,
          memory: { thread: name, resource: 'caller' },
        })
      : undefined;
  if (mode === 'worker') {
    const ctx = new JobContext(
      new JobProcess(),
      {
        fakeJob: true,
        job: new Job({
          id: name,
          metadata: JSON.stringify({ agentId: 'navigator', threadId: name, resourceId: 'caller' }),
          room: new RoomInfo({ name }),
        }),
        url: url!,
        token: '',
        workerId: 'dtmf-test',
        apiKey,
        apiSecret: secret,
        acceptArguments: { identity: 'worker', name: 'worker', metadata: '' },
      },
      room,
      () => {},
      () => {},
      {
        doInference: async () => {
          throw new Error('Unexpected inference');
        },
      },
    );
    let started: SessionStartArgs | undefined;
    await runWithJobContextAsync(ctx, () =>
      createLiveKitWorker({
        mastra,
        agent: 'navigator',
        dtmf: true,
        vad: false,
        observability: false,
        telephony: { direction: 'inbound', participantIdentity: 'caller' },
        ...(persist && { transcriptPersistence: 'memory' as const }),
        sessionOptions: { turnHandling: { turnDetection: 'manual', preemptiveGeneration: { enabled: preemptive } } },
        inputOptions: { participantIdentity: 'caller', audioEnabled: false, textEnabled: false },
        outputOptions: { audioEnabled: false, transcriptionEnabled: false },
        onSessionStart: args => {
          started = args;
        },
      }).entry(ctx),
    );
    session = started!.session;
    cleanups.push(async () => {
      await session.close();
      await Promise.all(ctx.shutdownCallbacks.map(callback => callback()));
    });
    return {
      room,
      caller,
      session,
      state,
      packets,
      connect,
      memory,
      name,
      run: async () => {
        await session.generateReply({ userInput: 'Press the requested keys.' }).waitForPlayout();
        await started?.transcriptPersistence?.flush();
        const last = session.history.items.filter(item => item.type === 'message' && item.role === 'assistant').at(-1);
        return last?.type === 'message' ? last.textContent : undefined;
      },
    };
  }
  session = new voice.AgentSession({
    turnHandling: { turnDetection: 'manual', preemptiveGeneration: { enabled: preemptive } },
  });
  cleanups.push(async () => {
    if (persistence) await persistence.close();
    else await session.close();
  });
  const tool = createDtmfTool({ room, session, participantIdentity: 'caller' });
  const plugin = new MastraLLM({
    ...(persistence
      ? { transcriptPersistence: persistence }
      : mode === 'local'
        ? { agent }
        : {
            remote: {
              baseUrl,
              agentId: 'navigator',
              apiPrefix: '/voice-api',
              headers: { Authorization: 'Bearer test-token' },
            },
          }),
    tools: { sendDtmf: tool },
  });
  persistence?.attach(session);
  await session.start({
    agent: new voice.Agent({ instructions: 'Navigate.', llm: plugin }),
    room,
    inputOptions: { participantIdentity: 'caller', audioEnabled: false, closeOnDisconnect: false },
    outputOptions: { audioEnabled: false },
  });
  const run = async () => {
    const stream = plugin.chat({
      chatCtx: new llm.ChatContext([llm.ChatMessage.create({ role: 'user', content: 'Press the requested keys.' })]),
      connOptions: { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 15000 },
    });
    let text = '';
    for await (const chunk of stream) text += chunk.delta?.content ?? '';
    return text;
  };
  return { room, caller, session, tool, plugin, state, packets, connect, run, memory, name, persistence };
}

const native = describe.skipIf(!url);
for (const mode of ['local', 'remote', 'worker'] as const) {
  native(`${mode} Mastra DTMF through native LiveKit`, () => {
    it('publishes ordered keypad events and returns the publishing result to the model', async () => {
      const f = await fixture(mode);
      expect(await f.run()).toBe('Listening.');
      await vi.waitFor(() =>
        expect(f.packets).toEqual([
          { code: 1, digit: '1' },
          { code: 2, digit: '2' },
          { code: 10, digit: '*' },
          { code: 11, digit: '#' },
          { code: 12, digit: 'A' },
          { code: 13, digit: 'B' },
          { code: 14, digit: 'C' },
          { code: 15, digit: 'D' },
          { code: 0, digit: '0' },
        ]),
      );
      expect(f.state.prompts).toHaveLength(2);
      expect(
        f.state.prompts[0]?.tools.some((t: { function: { name: string } }) => t.function.name === 'sendDtmf'),
      ).toBe(true);
      expect(JSON.stringify(f.state.prompts[1]?.messages)).toContain('12*#ABCD0');
      expect(JSON.stringify(f.state.prompts[1]?.messages)).toContain('complete');
      if (mode === 'remote') {
        expect(f.state.requests).toHaveLength(2);
        expect(f.state.requests.every(r => r.headers.get('Authorization') === 'Bearer test-token')).toBe(true);
        expect(f.state.requests.every(r => new URL(r.url).pathname === '/voice-api/agents/navigator/stream')).toBe(
          true,
        );
      }
    });

    it('rejects invalid digits before sending any keypad input', async () => {
      const f = await fixture(mode);
      f.state.digits = '1x';
      await f.run();
      expect(f.packets).toEqual([]);
      expect(JSON.stringify(f.state.prompts[1]?.messages)).toMatch(/validation|invalid|DTMF/i);
    });

    it('returns a failure when the intended caller has disconnected', async () => {
      const f = await fixture(mode);
      await f.caller.disconnect();
      await vi.waitFor(() => expect(f.room.remoteParticipants.has('caller')).toBe(false));
      if (mode === 'worker') await expect(f.run()).rejects.toThrow(/closing|not running/);
      else {
        await f.run();
        expect(JSON.stringify(f.state.prompts[1]?.messages)).toContain('expected SIP caller');
      }
      expect(f.packets).toEqual([]);
    });

    it('refuses room-wide tones when a second SIP caller is present', async () => {
      const f = await fixture(mode);
      await f.connect('other-caller', 'sip');
      await vi.waitFor(() => expect(f.room.remoteParticipants.has('other-caller')).toBe(true));
      await f.run();
      expect(f.packets).toEqual([]);
      expect(JSON.stringify(f.state.prompts[1]?.messages)).toContain('expected SIP caller');
    });

    if (mode !== 'worker')
      it('cancels a pending model request without sending keys or continuing the remote agent', async () => {
        const f = await fixture(mode);
        let release!: () => void;
        f.state.beforeModel = () =>
          new Promise<void>(resolve => {
            release = resolve;
          });
        const stream = f.plugin!.chat({
          chatCtx: new llm.ChatContext([llm.ChatMessage.create({ role: 'user', content: 'Press 1.' })]),
          connOptions: { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 10000 },
        });
        const drain = (async () => {
          for await (const _chunk of stream) {
            /* consume */
          }
        })();
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        stream.close();
        release();
        await drain;
        expect(f.packets).toEqual([]);
        expect(f.state.prompts).toHaveLength(1);
        if (mode === 'remote') expect(f.state.requests).toHaveLength(1);
      });

    if (mode === 'remote')
      it('preserves authentication failures without publishing or executing a model turn', async () => {
        const f = await fixture(mode);
        f.state.authorized = false;
        const errors: unknown[] = [];
        f.plugin!.on('error', error => errors.push(error));
        await f.run();
        expect(errors).toMatchObject([{ error: { statusCode: 401, retryable: false }, recoverable: false }]);
        expect(f.state.requests).toHaveLength(1);
        expect(f.state.prompts).toHaveLength(0);
        expect(f.packets).toEqual([]);
      });

    it('saves the executed keypad tool and result with opt-in transcript persistence', async () => {
      const f = await fixture(mode, false, true);
      if (mode === 'worker') await f.run();
      else {
        await f.session.generateReply({ userInput: 'Press the requested keys.' }).waitForPlayout();
        await f.persistence?.flush();
      }
      const messages = (await f.memory.recall({ threadId: f.name, resourceId: 'caller' })).messages;
      const saved = JSON.stringify(messages);
      expect(saved).toContain('sendDtmf');
      expect(saved).toContain('12*#ABCD0');
      expect(saved).toContain('complete');
      await vi.waitFor(() => expect(f.packets).toHaveLength(9));
    });

    it('does not execute irreversible keypad actions with speculative generation enabled', async () => {
      const f = await fixture(mode, true);
      await f.run();
      expect(f.packets).toEqual([]);
      expect(JSON.stringify(f.state.prompts[1]?.messages)).toContain('Disable preemptive generation');
    });
  });
}

native('DTMF call binding', () => {
  it('keeps simultaneous calls in their own rooms and refuses overlapping sequences on one tool', async () => {
    const first = await fixture('local');
    const second = await fixture('remote');
    const [one, overlap, two] = await Promise.all([
      first.tool!.execute!({ digits: '123#' }, { observe: noopObserve }),
      first.tool!.execute!({ digits: '9' }, { observe: noopObserve }),
      second.tool!.execute!({ digits: '456*' }, { observe: noopObserve }),
    ]);
    expect(one).toEqual({ published: '123#', complete: true });
    expect(overlap).toMatchObject({ published: '', complete: false });
    expect(two).toEqual({ published: '456*', complete: true });
    await vi.waitFor(() => expect(first.packets.map(p => p.digit).join('')).toBe('123#'));
    await vi.waitFor(() => expect(second.packets.map(p => p.digit).join('')).toBe('456*'));
  });

  it('reports the acknowledged prefix when cancellation stops a sequence, without retrying it', async () => {
    const f = await fixture('local');
    const abort = new AbortController();
    f.caller.on(RoomEvent.DtmfReceived, () => abort.abort(new Error('Stop keys')));
    const digits = '123#'.repeat(250);
    const result = await f.tool!.execute!({ digits }, { observe: noopObserve, abortSignal: abort.signal });
    expect(result).toMatchObject({ complete: false, error: 'Stop keys' });
    if (result && 'published' in result) {
      expect(result.published.length).toBeGreaterThan(0);
      expect(result.published.length).toBeLessThan(digits.length);
      expect(result.published).toBe(digits.slice(0, result.published.length));
      await vi.waitFor(() => expect(f.packets.map(p => p.digit).join('')).toBe(result.published));
    }
  });

  it('does not publish after the operation has been cancelled or the session has closed', async () => {
    const f = await fixture('local');
    const abort = new AbortController();
    abort.abort(new Error('Turn cancelled'));
    expect(await f.tool!.execute!({ digits: '1' }, { observe: noopObserve, abortSignal: abort.signal })).toMatchObject({
      published: '',
      complete: false,
      error: 'Turn cancelled',
    });
    await f.session.close();
    expect(await f.tool!.execute!({ digits: '2' }, { observe: noopObserve })).toMatchObject({
      published: '',
      complete: false,
    });
    expect(f.packets).toEqual([]);
  });
});
