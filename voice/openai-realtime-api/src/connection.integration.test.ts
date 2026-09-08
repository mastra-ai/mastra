import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { OpenAIRealtimeVoice } from './index';

const servers: WebSocketServer[] = [];
const voices: OpenAIRealtimeVoice[] = [];

async function setup(onConnection: (socket: WebSocket) => void, connectTimeoutMs = 200) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  servers.push(server);
  await once(server, 'listening');
  server.on('connection', onConnection);
  const voice = new OpenAIRealtimeVoice({
    apiKey: 'test-key',
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
    connectTimeoutMs,
  });
  voices.push(voice);
  return { voice, server };
}

const session = JSON.stringify({ type: 'session.created', session: {} });
const failure = JSON.stringify({ type: 'error', error: { message: 'Invalid API key', code: 'invalid_api_key' } });

afterEach(async () => {
  for (const voice of voices.splice(0)) voice.disconnect();
  await Promise.all(
    servers.splice(0).map(server => {
      for (const socket of server.clients) socket.terminate();
      return new Promise<void>(resolve => server.close(() => resolve()));
    }),
  );
});

describe('real WebSocket connection handshake', () => {
  it('resolves and sends configuration after session creation', async () => {
    let config: Promise<unknown> | undefined;
    const { voice } = await setup(socket => {
      config = once(socket, 'message');
      socket.send(session);
    });
    await expect(voice.connect()).resolves.toBeUndefined();
    const message = await config;
    expect(String((message as Buffer[])[0])).toContain('session.update');
  });

  it.each([false, true])('rejects protocol failure (close=%s)', async close => {
    const { voice } = await setup(socket => {
      socket.send(failure);
      if (close) socket.close();
    });
    await expect(voice.connect()).rejects.toThrow('Invalid API key');
  });

  it('rejects a close before session creation', async () => {
    const { voice } = await setup(socket => socket.close(1008, 'rejected'));
    await expect(voice.connect()).rejects.toThrow('1008: rejected');
  });

  it('rejects a silent open connection', async () => {
    const { voice } = await setup(() => {});
    await expect(voice.connect()).rejects.toThrow('timed out after 200ms');
  });

  it('rejects connection refusal without an unhandled socket error', async () => {
    const { voice, server } = await setup(() => {});
    await new Promise<void>(resolve => server.close(() => resolve()));
    servers.splice(servers.indexOf(server), 1);
    await expect(voice.connect()).rejects.toThrow('ECONNREFUSED');
  });

  it('rejects explicit disconnect while connecting', async () => {
    const { voice } = await setup(() => {});
    const connection = voice.connect();
    const rejection = expect(connection).rejects.toThrow('disconnected during handshake');
    voice.disconnect();
    await rejection;
  });

  it('allows retry without duplicate consumer events', async () => {
    let attempts = 0;
    const { voice } = await setup(socket => socket.send(attempts++ === 0 ? failure : session));
    let sessions = 0;
    voice.on('session.created', () => sessions++);
    await expect(voice.connect()).rejects.toThrow('Invalid API key');
    await voice.connect();
    expect(sessions).toBe(1);
  });
});
