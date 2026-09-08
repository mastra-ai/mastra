import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { OpenAIRealtimeVoice } from './index';

describe('public realtime input events', () => {
  let server: WebSocketServer | undefined;
  let voice: OpenAIRealtimeVoice | undefined;

  afterEach(async () => {
    voice?.disconnect();
    for (const socket of server?.clients ?? []) socket.terminate();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  });

  const setup = async () => {
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    server.on('connection', socket => socket.send(JSON.stringify({ type: 'session.created', session: { id: 'test' } })));
    voice = new OpenAIRealtimeVoice({
      apiKey: 'local-test-only',
      url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    return { server, voice };
  };

  const frames = [
    { type: 'input_audio_buffer.speech_started', event_id: 'start', item_id: 'input', audio_start_ms: 0 },
    { type: 'input_audio_buffer.speech_stopped', event_id: 'stop', item_id: 'input', audio_end_ms: 1500 },
    {
      type: 'conversation.item.input_audio_transcription.completed', event_id: 'transcript', item_id: 'input',
      content_index: 0, transcript: 'Hello.', usage: { type: 'duration', seconds: 1.5 },
    },
  ];

  it.each(frames)('forwards $type and its full payload once', async frame => {
    const { server, voice } = await setup();
    const callback = vi.fn();
    voice.on(frame.type, callback);
    const received = new Promise(resolve => voice.on(frame.type, resolve));
    await voice.connect();
    const peer = [...server.clients][0]!;
    peer.send(JSON.stringify(frame));
    expect(await received).toEqual(frame);
    expect(callback).toHaveBeenCalledExactlyOnceWith(frame);
  });

  it('does not duplicate transcription or writing events after reconnect', async () => {
    const { server, voice } = await setup();
    const completed = vi.fn();
    const writing = vi.fn();
    voice.on(frames[2]!.type, completed);
    voice.on('writing', writing);
    for (let connection = 0; connection < 2; connection++) {
      await voice.connect();
      const peer = [...server.clients].find(socket => socket.readyState === WebSocket.OPEN)!;
      const received = new Promise(resolve => voice.on('writing', resolve));
      peer.send(JSON.stringify(frames[2]));
      await received;
      expect(completed).toHaveBeenCalledTimes(connection + 1);
      expect(writing).toHaveBeenCalledTimes((connection + 1) * 2);
      expect(writing.mock.calls.slice(connection * 2)).toEqual([
        [{ text: 'Hello.', response_id: 'input', role: 'user' }],
        [{ text: '\n', response_id: 'input', role: 'user' }],
      ]);
      const closed = once(peer, 'close');
      voice.disconnect();
      await closed;
    }
  });

  it('removes the public transcription listener without removing writing', async () => {
    const { server, voice } = await setup();
    const callback = vi.fn();
    voice.on(frames[2]!.type, callback);
    voice.off(frames[2]!.type, callback);
    const written = new Promise(resolve => voice.on('writing', resolve));
    await voice.connect();
    [...server.clients][0]!.send(JSON.stringify(frames[2]));
    await written;
    expect(callback).not.toHaveBeenCalled();
  });
});
