import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { OpenAIRealtimeVoice } from './index';

const speechStarted = {
  type: 'input_audio_buffer.speech_started',
  event_id: 'start',
  item_id: 'input',
  audio_start_ms: 0,
};
const speechStopped = {
  type: 'input_audio_buffer.speech_stopped',
  event_id: 'stop',
  item_id: 'input',
  audio_end_ms: 1500,
};
const transcriptionWithoutUsage = {
  type: 'conversation.item.input_audio_transcription.completed',
  event_id: 'transcript',
  item_id: 'input',
  content_index: 0,
  transcript: 'Hello.',
};
const transcription = { ...transcriptionWithoutUsage, usage: { type: 'duration', seconds: 1.5 } };
const frames = [speechStarted, speechStopped, transcription];
const servers: WebSocketServer[] = [];
const voices: OpenAIRealtimeVoice[] = [];

async function setup() {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  servers.push(server);
  await once(server, 'listening');
  server.on('connection', socket => socket.send(JSON.stringify({ type: 'session.created', session: {} })));
  const voice = new OpenAIRealtimeVoice({
    apiKey: 'local-test-only',
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
    connectTimeoutMs: 2000,
  });
  voices.push(voice);
  return { server, voice };
}

async function connect(voice: OpenAIRealtimeVoice, server: WebSocketServer) {
  const connected = new Promise<WebSocket>(resolve => server.once('connection', resolve));
  await voice.connect();
  return connected;
}

async function sendFrames(voice: OpenAIRealtimeVoice, peer: WebSocket, events: object[]) {
  let onDone: () => void;
  let timer: ReturnType<typeof setTimeout>;
  const delivered = new Promise<void>((resolve, reject) => {
    onDone = resolve;
    voice.on('response.done', onDone);
    timer = setTimeout(() => reject(new Error('Timed out waiting for response.done delivery barrier')), 2000);
  });
  try {
    for (const event of events) peer.send(JSON.stringify(event));
    // This known public event proves preceding WebSocket frames have been processed.
    peer.send(JSON.stringify({ type: 'response.done', response: { id: 'barrier', output: [] } }));
    await delivered;
  } finally {
    clearTimeout(timer!);
    voice.off('response.done', onDone!);
  }
}

afterEach(async () => {
  for (const voice of voices.splice(0)) voice.disconnect();
  await Promise.all(
    servers.splice(0).map(server => {
      for (const socket of server.clients) socket.terminate();
      return new Promise<void>(resolve => server.close(() => resolve()));
    }),
  );
});

describe('public realtime input events', () => {
  it.each(frames)('forwards the complete $type payload exactly once', async frame => {
    const { voice, server } = await setup();
    const callback = vi.fn();
    voice.on(frame.type, callback);
    const peer = await connect(voice, server);
    await sendFrames(voice, peer, [frame]);
    expect(callback).toHaveBeenCalledExactlyOnceWith(frame);
  });

  it.each([
    { name: 'duration', usage: transcription.usage },
    { name: 'tokens', usage: { type: 'tokens', total_tokens: 12, input_tokens: 10, output_tokens: 2 } },
    { name: 'absent', usage: undefined },
  ])('preserves $name usage and completed-only writing', async ({ usage }) => {
    const { voice, server } = await setup();
    const completed = vi.fn();
    const writing = vi.fn();
    voice.on(transcription.type, completed);
    voice.on('writing', writing);
    const frame = usage === undefined ? transcriptionWithoutUsage : { ...transcriptionWithoutUsage, usage };
    const peer = await connect(voice, server);
    await sendFrames(voice, peer, [frame]);
    expect(completed).toHaveBeenCalledExactlyOnceWith(frame);
    expect(writing.mock.calls).toEqual([
      [{ text: 'Hello.', response_id: 'input', role: 'user' }],
      [{ text: '\n', response_id: 'input', role: 'user' }],
    ]);
  });

  it('forwards completion after deltas without repeating the transcript', async () => {
    const { voice, server } = await setup();
    const completed = vi.fn();
    const writing = vi.fn();
    voice.on(transcription.type, completed);
    voice.on('writing', writing);
    const peer = await connect(voice, server);
    await sendFrames(voice, peer, [
      {
        type: 'conversation.item.input_audio_transcription.delta',
        item_id: 'input',
        content_index: 0,
        delta: 'Hello.',
      },
      transcription,
    ]);
    expect(completed).toHaveBeenCalledExactlyOnceWith(transcription);
    expect(writing.mock.calls).toEqual([
      [{ text: 'Hello.', response_id: 'input', role: 'user' }],
      [{ text: '\n', response_id: 'input', role: 'user' }],
    ]);
  });

  it('forwards completion even when the transcript is empty', async () => {
    const { voice, server } = await setup();
    const completed = vi.fn();
    const writing = vi.fn();
    voice.on(transcription.type, completed);
    voice.on('writing', writing);
    const peer = await connect(voice, server);
    const frame = { ...transcription, transcript: '' };
    await sendFrames(voice, peer, [frame]);
    expect(completed).toHaveBeenCalledExactlyOnceWith(frame);
    expect(writing).toHaveBeenCalledExactlyOnceWith({ text: '\n', response_id: 'input', role: 'user' });
  });

  it('preserves subscriptions across reconnects without duplicating native or writing events', async () => {
    const { voice, server } = await setup();
    const callbacks = frames.map(frame => {
      const callback = vi.fn();
      voice.on(frame.type, callback);
      return callback;
    });
    const writing = vi.fn();
    voice.on('writing', writing);
    for (let connection = 0; connection < 2; connection++) {
      const peer = await connect(voice, server);
      await sendFrames(voice, peer, frames);
      callbacks.forEach((callback, index) => {
        expect(callback).toHaveBeenCalledTimes(connection + 1);
        expect(callback).toHaveBeenLastCalledWith(frames[index]);
      });
      expect(writing.mock.calls.slice(connection * 2)).toEqual([
        [{ text: 'Hello.', response_id: 'input', role: 'user' }],
        [{ text: '\n', response_id: 'input', role: 'user' }],
      ]);
      const closed = once(peer, 'close');
      voice.disconnect();
      await closed;
    }
  });

  it.each(frames)('removes a $type listener without affecting other listeners or writing', async frame => {
    const { voice, server } = await setup();
    const removed = vi.fn();
    const retained = vi.fn();
    const writing = vi.fn();
    voice.on(frame.type, removed);
    voice.on(frame.type, retained);
    voice.on('writing', writing);
    const peer = await connect(voice, server);
    await sendFrames(voice, peer, frames);
    expect(removed).toHaveBeenCalledExactlyOnceWith(frame);
    voice.off(frame.type, removed);
    await sendFrames(voice, peer, frames);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(retained).toHaveBeenCalledTimes(2);
    expect(retained).toHaveBeenLastCalledWith(frame);
    expect(writing).toHaveBeenCalledTimes(4);
  });
});
