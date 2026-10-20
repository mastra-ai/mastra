import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { initializeLogger, JobContext, JobProcess, runWithJobContextAsync } from '@livekit/agents';
import { Job, Room as RoomInfo, SIPOutboundConfig } from '@livekit/protocol';
import { Room } from '@livekit/rtc-node';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RoomServiceClient, SipCallError, SipClient, TokenVerifier } from 'livekit-server-sdk';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LiveKitOutboundCallOptions } from './telephony';
import { createLiveKitWorker } from './worker';
import type { CreateLiveKitWorkerOptions, SessionStartArgs } from './worker';

beforeAll(() => initializeLogger({ level: 'silent', pretty: false }));
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

const apiKey = 'devkey';
const secret = 'secret-secret-secret-secret-secret';

async function fixture() {
  const requests: Array<{ method: string; body: Record<string, unknown>; sipGrant?: boolean }> = [];
  let dialResponse: ServerResponse | undefined;
  let cleanupFails = false;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const claims = await new TokenVerifier(apiKey, secret).verify(req.headers.authorization!.slice(7));
    const method = req.url!.split('/').at(-1)!;
    requests.push({ method, body, sipGrant: claims.sip?.call });
    res.setHeader('Content-Type', 'application/json');
    if (method === 'CreateSIPParticipant') {
      dialResponse = res;
      // Model the service's acceptance-vs-answer contract, not just the request shape.
      if (!body.waitUntilAnswered) res.end(JSON.stringify({ participantIdentity: 'callee', roomName: 'call-room' }));
      return;
    }
    res.statusCode = cleanupFails ? 500 : 200;
    res.end(JSON.stringify(cleanupFails ? { code: 'unavailable', msg: 'Cleanup unavailable' } : {}));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local server port');
  const url = `http://127.0.0.1:${address.port}`;
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  const sipClient = new SipClient(url, apiKey, secret, { failover: false });
  const roomClient = new RoomServiceClient(url, apiKey, secret, { failover: false });
  const shutdowns: string[] = [];
  const metadata = { agentId: 'support', threadId: 'thread', resourceId: 'caller' };
  const room = new Room();
  // Native fake jobs are provided by LiveKit for non-network sessions. The SIP SDK still uses
  // real HTTP; no agent, session, SDK client method, or fetch implementation is mocked here.
  const ctx = new JobContext(
    new JobProcess(),
    {
      job: new Job({
        id: 'telephony-test',
        metadata: JSON.stringify(metadata),
        room: new RoomInfo({ name: 'call-room' }),
      }),
      fakeJob: true,
      url,
      token: '',
      workerId: 'worker',
      acceptArguments: { identity: 'worker', name: 'worker', metadata: '' },
    },
    room,
    () => {},
    reason => shutdowns.push(reason),
    {
      doInference: async () => {
        throw new Error('Unexpected inference');
      },
    },
  );
  const agent = new Agent({ id: 'support', name: 'Support', instructions: 'Help.', model: new MockLanguageModelV2() });
  const mastra = new Mastra({ agents: { support: agent }, logger: false });
  const warnings = vi.spyOn(mastra.getLogger(), 'warn');
  const events: string[] = [];
  let started: SessionStartArgs | undefined;
  cleanups.push(async () => {
    await started?.session.close();
    await Promise.all(ctx.shutdownCallbacks.map(callback => callback()));
    await room.disconnect();
  });
  const telephony: LiveKitOutboundCallOptions = {
    direction: 'outbound',
    sipClient,
    sipTrunkId: 'ST_test',
    phoneNumber: '+15555550123',
    participantOptions: { participantIdentity: 'callee', ringingTimeout: 20, maxCallDuration: 180 },
    deleteRoomOnFailure: roomClient,
  };
  const run = (overrides: Partial<CreateLiveKitWorkerOptions> = {}) =>
    runWithJobContextAsync(ctx, () =>
      createLiveKitWorker({
        mastra,
        vad: false,
        observability: false,
        memory: false,
        turnDetection: 'manual',
        telephony,
        inputOptions: { audioEnabled: false, textEnabled: false },
        outputOptions: { audioEnabled: false, transcriptionEnabled: false },
        configuration: {
          greeting: {
            text: () => {
              events.push('greeting');
              return 'Hello';
            },
            persist: false,
          },
        },
        onSessionStart: args => {
          started = args;
          events.push('started');
        },
        ...overrides,
      }).entry(ctx),
    );
  const waitForDial = () => vi.waitFor(() => expect(dialResponse).toBeDefined());
  const answer = () =>
    dialResponse!.end(
      JSON.stringify({
        participantId: 'PA_callee',
        participantIdentity: 'callee',
        roomName: 'call-room',
        sipCallId: 'SC_test',
      }),
    );
  const reject = (code: number) => {
    dialResponse!.statusCode = 500;
    dialResponse!.end(
      JSON.stringify({
        code: 'internal',
        msg: 'Dial failed',
        meta: {
          sip_status_code: String(code),
          sip_status: code === 486 ? 'Busy Here' : 'Request Timeout',
        },
      }),
    );
  };
  return {
    run,
    requests,
    events,
    shutdowns,
    warnings,
    telephony,
    ctx,
    waitForDial,
    answer,
    reject,
    disconnect: () => dialResponse!.destroy(),
    failCleanup: () => {
      cleanupFails = true;
    },
    get started() {
      return started;
    },
  };
}

describe('telephony worker through the native LiveKit SDK', () => {
  it('does not start the session or greeting until the native answer request finishes', async () => {
    const f = await fixture();
    const originalOptions = { ...f.telephony.participantOptions };
    const running = f.run();
    await f.waitForDial();
    expect(f.events).toEqual([]);
    expect(f.requests).toEqual([
      {
        method: 'CreateSIPParticipant',
        sipGrant: true,
        body: expect.objectContaining({
          sipTrunkId: 'ST_test',
          sipCallTo: '+15555550123',
          roomName: 'call-room',
          participantIdentity: 'callee',
          waitUntilAnswered: true,
          ringingTimeout: '20s',
          maxCallDuration: '180s',
        }),
      },
    ]);
    f.answer();
    await running;
    expect(f.events).toEqual(['greeting', 'started']);
    expect(f.started?.sipParticipant).toMatchObject({ participantIdentity: 'callee', sipCallId: 'SC_test' });
    expect(f.telephony.participantOptions).toEqual(originalOptions);
    expect(f.shutdowns).toEqual([]);
  });

  it.each([486, 408])('preserves native SIP %s details and cleans up without greeting or redial', async code => {
    const f = await fixture();
    const failure = f.run().catch(error => error);
    await f.waitForDial();
    f.reject(code);
    const error = await failure;
    expect(error).toBeInstanceOf(SipCallError);
    expect(error.sipStatusCode).toBe(code);
    expect(f.events).toEqual([]);
    expect(f.requests.map(request => request.method)).toEqual(['CreateSIPParticipant', 'DeleteRoom']);
    expect(f.requests[1]?.body).toEqual({ room: 'call-room' });
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it('preserves a carrier rejection when room cleanup also fails', async () => {
    const f = await fixture();
    f.failCleanup();
    const failure = f.run().catch(error => error);
    await f.waitForDial();
    f.reject(486);
    expect(await failure).toMatchObject({ sipStatusCode: 486 });
    expect(f.warnings).toHaveBeenCalledWith(expect.stringContaining('failed to delete'), expect.any(Error));
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it('does not turn an ambiguous transport failure into a carrier rejection or a second dial', async () => {
    const f = await fixture();
    const failure = f.run().catch(error => error);
    await f.waitForDial();
    f.disconnect();
    const error = await failure;
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SipCallError);
    expect(f.events).toEqual([]);
    expect(f.requests.filter(request => request.method === 'CreateSIPParticipant')).toHaveLength(1);
  });

  it('retains a shared room when deletion was not explicitly configured', async () => {
    const f = await fixture();
    const failure = f.run({ telephony: { ...f.telephony, deleteRoomOnFailure: undefined } }).catch(error => error);
    await f.waitForDial();
    f.reject(486);
    expect(await failure).toBeInstanceOf(SipCallError);
    expect(f.requests.map(request => request.method)).toEqual(['CreateSIPParticipant']);
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it.each([{ agent: 'unknown' }, { inputOptions: { participantIdentity: 'somebody-else' } }])(
    'rejects invalid agent or participant routing before dialing: %j',
    async overrides => {
      const f = await fixture();
      await expect(f.run(overrides)).rejects.toThrow();
      expect(f.requests.filter(request => request.method === 'CreateSIPParticipant')).toEqual([]);
      expect(f.events).toEqual([]);
    },
  );

  it.each([
    { phoneNumber: '' },
    { sipTrunkId: '' },
    { participantOptions: { ringingTimeout: -1 } },
    { participantOptions: { ringingTimeout: 1.5 } },
    { participantOptions: { waitUntilAnswered: false } },
  ])('rejects invalid dialing configuration before dialing: %j', async invalid => {
    const f = await fixture();
    await expect(f.run({ telephony: { ...f.telephony, ...invalid } as LiveKitOutboundCallOptions })).rejects.toThrow();
    expect(f.requests.filter(request => request.method === 'CreateSIPParticipant')).toEqual([]);
    expect(f.events).toEqual([]);
  });

  it('runs a per-job resolver once and passes native inline trunk configuration', async () => {
    const f = await fixture();
    const contexts: unknown[] = [];
    const running = f.run({
      telephony: args => {
        contexts.push(args.metadata);
        return {
          ...f.telephony,
          sipTrunkId: '',
          outboundTrunkConfig: new SIPOutboundConfig({ hostname: 'sip.test' }),
          participantOptions: { participantIdentity: 'callee', fromNumber: '+15555550000' },
        };
      },
    });
    await f.waitForDial();
    f.answer();
    await running;
    expect(contexts).toEqual([{ agentId: 'support', threadId: 'thread', resourceId: 'caller' }]);
    expect(f.requests[0]?.body).toMatchObject({
      trunk: { hostname: 'sip.test' },
      sipNumber: '+15555550000',
      waitUntilAnswered: true,
    });
  });

  it('cleans up a known dedicated room when dispatch validation fails', async () => {
    const f = await fixture();
    f.ctx.job.metadata = '{';
    await expect(f.run({ sessionConfigFromMetadata: true })).rejects.toThrow();
    expect(f.requests.map(request => request.method)).toEqual(['DeleteRoom']);
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it('shuts down without deleting a room when the telephony resolver fails before choosing ownership', async () => {
    const f = await fixture();
    const error = new Error('Unknown project');
    await expect(
      f.run({
        telephony: () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(f.requests).toEqual([]);
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it('cleans up an answered call if the greeting resolver rejects startup', async () => {
    const f = await fixture();
    const error = new Error('Greeting configuration failed');
    const failure = f
      .run({
        configuration: {
          greeting: {
            text: () => {
              throw error;
            },
          },
        },
      })
      .catch(error => error);
    await f.waitForDial();
    f.answer();
    expect(await failure).toBe(error);
    expect(f.requests.map(request => request.method)).toEqual(['CreateSIPParticipant', 'DeleteRoom']);
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  });

  it.each([false, true])('preserves browser startup without telephony (resolver: %s)', async resolver => {
    const f = await fixture();
    await f.run({ telephony: resolver ? () => undefined : undefined });
    expect(f.requests).toEqual([]);
    expect(f.events).toEqual(['greeting', 'started']);
    expect(f.started?.sipParticipant).toBeUndefined();
    expect(f.shutdowns).toEqual([]);
  });
});
