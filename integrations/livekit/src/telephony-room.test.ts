import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { initializeLogger, JobContext, JobProcess, runWithJobContextAsync } from '@livekit/agents';
import { Job, Room as RoomInfo } from '@livekit/protocol';
import { ParticipantKind, Room } from '@livekit/rtc-node';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLiveKitWorker } from './worker';
import type { CreateLiveKitWorkerOptions, SessionStartArgs } from './worker';

// Run against a local livekit-server --dev. A native RTC participant with a SIP-kind token
// simulates the SIP service boundary; no phone provider is configured or contacted.
const url = process.env.LIVEKIT_TEST_ROOM_URL;
const apiKey = process.env.LIVEKIT_TEST_ROOM_API_KEY ?? 'devkey';
const secret = process.env.LIVEKIT_TEST_ROOM_API_SECRET ?? 'secret';
beforeAll(() => {
  initializeLogger({ level: 'silent', pretty: false });
  if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('LIVEKIT_TEST_ROOM_URL must point to a local test server');
  }
});
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(kind = 'sip', withObserver = false) {
  const roomName = `mastra-telephony-${crypto.randomUUID()}`;
  const client = new RoomServiceClient(url!, apiKey, secret, { failover: false });
  await client.createRoom({ name: roomName });
  cleanups.push(() => client.deleteRoom(roomName).catch(() => {}));
  const token = async (identity: string, participantKind: string) => {
    const token = new AccessToken(apiKey, secret, { identity, ttl: '5m' });
    token.kind = participantKind;
    token.attributes = { 'sip.trunkPhoneNumber': '+15555550111', 'sip.phoneNumber': '+15555550222' };
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return token.toJwt();
  };
  const observer = withObserver ? new Room() : undefined;
  if (observer) {
    cleanups.push(() => observer.disconnect());
    await observer.connect(url!, await token('observer', 'standard'));
  }
  const caller = new Room();
  cleanups.push(() => caller.disconnect());
  if (!withObserver) await caller.connect(url!, await token('caller', kind));
  const workerRoom = new Room();
  cleanups.push(() => workerRoom.disconnect());
  const shutdowns: string[] = [];
  const ctx = new JobContext(
    new JobProcess(),
    {
      job: new Job({
        id: `job-${roomName}`,
        metadata: JSON.stringify({ requestContext: { source: 'dispatch' } }),
        room: new RoomInfo({ name: roomName }),
      }),
      url: url!,
      token: await token('worker', 'agent'),
      workerId: 'test-worker',
      apiKey,
      apiSecret: secret,
      acceptArguments: { identity: 'worker', name: 'worker', metadata: '' },
    },
    workerRoom,
    () => {},
    reason => shutdowns.push(reason),
    {
      doInference: async () => {
        throw new Error('Unexpected inference');
      },
    },
  );
  if (withObserver) {
    // Establish the observer in the worker room before the SIP caller joins, avoiding
    // dependence on the server's unordered initial participant list.
    await ctx.connect();
    await caller.connect(url!, await token('caller', kind));
    await ctx.waitForParticipant('caller');
  }
  const storage = new LibSQLStore({ id: crypto.randomUUID(), url: ':memory:' });
  cleanups.push(() => storage.close());
  const memory = new Memory({ storage, options: { semanticRecall: false } });
  const agent = new Agent({
    id: 'support',
    name: 'Support',
    instructions: 'Help.',
    model: new MockLanguageModelV2(),
    memory,
  });
  const mastra = new Mastra({ agents: { support: agent }, logger: false, storage });
  const greetings: string[] = [];
  let started: SessionStartArgs | undefined;
  cleanups.push(async () => {
    await started?.session.close();
    await Promise.all(ctx.shutdownCallbacks.map(callback => callback()));
  });
  const run = (overrides: Partial<CreateLiveKitWorkerOptions> = {}) =>
    runWithJobContextAsync(ctx, () =>
      createLiveKitWorker({
        mastra,
        vad: false,
        observability: false,
        turnDetection: 'manual',
        transcriptPersistence: 'memory',
        sessionConfigFromMetadata: true,
        telephony: {
          direction: 'inbound',
          participantIdentity: 'caller',
          deleteRoomOnFailure: client,
          resolveMetadata: ({ metadata, participant, ctx }) => {
            if (participant.attributes['sip.trunkPhoneNumber'] !== '+15555550111') throw new Error('Unknown route');
            return {
              ...metadata,
              agentId: 'support',
              threadId: ctx.room.name!,
              resourceId: `call:${ctx.room.name}`,
              requestContext: { ...metadata.requestContext, tenant: 'support-desk' },
              sessionConfig: { version: 1, options: { userAwayTimeout: 30 } },
            };
          },
        },
        inputOptions: { audioEnabled: false, textEnabled: false },
        outputOptions: { audioEnabled: false, transcriptionEnabled: false },
        configuration: {
          greeting: {
            text: ({ requestContext }) => {
              const text = `Hello from ${requestContext?.get('tenant')}`;
              greetings.push(text);
              return text;
            },
            awaitPlayout: true,
          },
        },
        onSessionStart: args => {
          started = args;
        },
        ...overrides,
      }).entry(ctx),
    );
  return {
    observer,
    run,
    ctx,
    caller,
    client,
    roomName,
    memory,
    agent,
    shutdowns,
    greetings,
    get started() {
      return started;
    },
  };
}

describe.skipIf(!url)('inbound telephony in native LiveKit rooms', () => {
  it('routes before agent selection and saves the greeting in the resolved Memory thread', async () => {
    const f = await fixture();
    let selectedParticipantKind: ParticipantKind | undefined;
    await f.run({
      agent: ({ metadata, participant }) => {
        selectedParticipantKind = participant?.kind;
        expect(metadata.agentId).toBe('support');
        return f.agent;
      },
    });
    expect(selectedParticipantKind).toBe(ParticipantKind.SIP);
    expect(f.started?.participant?.identity).toBe('caller');
    expect(f.started?.metadata.requestContext).toEqual({ source: 'dispatch', tenant: 'support-desk' });
    expect(f.started?.session.sessionOptions.userAwayTimeout).toBe(30);
    expect(f.greetings).toEqual(['Hello from support-desk']);
    await f.started!.transcriptPersistence!.flush();
    const rows = (await f.memory.recall({ threadId: f.roomName, resourceId: `call:${f.roomName}` })).messages;
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]?.content)).toContain('Hello from support-desk');
    expect(rows[0]?.role).toBe('assistant');
  }, 30000);

  it('binds native input to the routed SIP caller instead of the first room participant', async () => {
    const f = await fixture('sip', true);
    const received: string[] = [];
    await f.run({
      inputOptions: {
        audioEnabled: false,
        textEnabled: true,
        textInputCallback: (_session, event) => {
          received.push(event.text);
        },
      },
    });
    await f.observer!.localParticipant!.sendText('Unrelated participant', { topic: 'lk.chat' });
    await f.caller.localParticipant!.sendText('Routed caller', { topic: 'lk.chat' });
    await vi.waitFor(() => expect(received).toEqual(['Routed caller']));
  }, 30000);

  it('rejects an unknown route and disconnects the caller without a greeting', async () => {
    const f = await fixture();
    const rejection = new Error('Unknown inbound route');
    await expect(
      f.run({
        telephony: {
          direction: 'inbound',
          participantIdentity: 'caller',
          deleteRoomOnFailure: f.client,
          resolveMetadata: () => {
            throw rejection;
          },
        },
      }),
    ).rejects.toBe(rejection);
    expect(f.greetings).toEqual([]);
    expect(await f.client.listRooms([f.roomName])).toEqual([]);
    await vi.waitFor(() => expect(f.caller.isConnected).toBe(false));
    expect(f.shutdowns).toEqual(['telephony setup failed']);
  }, 30000);

  it('validates resolved session settings before greeting or generation', async () => {
    const f = await fixture();
    await expect(
      f.run({
        telephony: {
          direction: 'inbound',
          participantIdentity: 'caller',
          deleteRoomOnFailure: f.client,
          resolveMetadata: () => ({
            agentId: 'support',
            sessionConfig: { version: 1, options: { userAwayTimeout: -1 } },
          }),
        },
      }),
    ).rejects.toThrow();
    expect(f.greetings).toEqual([]);
    expect(await f.client.listRooms([f.roomName])).toEqual([]);
  }, 30000);

  it('rejects a browser participant selected as an inbound SIP caller', async () => {
    const f = await fixture('standard');
    await expect(f.run()).rejects.toThrow('inbound telephony requires a SIP participant');
    expect(f.greetings).toEqual([]);
    expect(await f.client.listRooms([f.roomName])).toEqual([]);
  }, 30000);
});
