import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { XAIRealtimeVoice } from './index';

vi.mock('ws', () => {
  const __require = typeof require === 'function' ? require : createRequire(import.meta.url);
  const EventEmitter = __require('node:events');

  class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: MockWebSocket[] = [];
    static autoOpen = true;

    readyState = MockWebSocket.CONNECTING;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', 1000, Buffer.from('closed'));
    });

    constructor(
      public url: string,
      public protocols?: string | string[],
      public options?: Record<string, any>,
    ) {
      super();
      MockWebSocket.instances.push(this);
      if (MockWebSocket.autoOpen) {
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.emit('open');
        }, 0);
      }
    }

    simulateMessage(data: Record<string, unknown>) {
      this.emit('message', Buffer.from(JSON.stringify(data)));
    }

    simulateClose(code = 1006, reason = 'network close') {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', code, Buffer.from(reason));
    }
  }

  return { WebSocket: MockWebSocket };
});

const sockets = () => (WebSocket as any).instances as any[];
const latestSocket = () => sockets().at(-1);
const sentEvents = (ws = latestSocket()) => ws.send.mock.calls.map(([payload]: [string]) => JSON.parse(payload));
const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

describe('XAIRealtimeVoice', () => {
  let voice: XAIRealtimeVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    (WebSocket as any).instances = [];
    (WebSocket as any).autoOpen = true;
    voice = new XAIRealtimeVoice({ apiKey: 'test-xai-key' });
  });

  afterEach(() => {
    voice.close();
  });

  it('initializes with documented xAI defaults and speakers', async () => {
    expect(voice).toBeInstanceOf(XAIRealtimeVoice);

    const speakers = await voice.getSpeakers();
    expect(speakers.map(speaker => speaker.voiceId)).toEqual(['eve', 'ara', 'rex', 'sal', 'leo']);
    expect(await voice.getListener()).toEqual({ enabled: true });
  });

  it('connects to xAI with API key auth and sends the initial session update', async () => {
    voice = new XAIRealtimeVoice({
      apiKey: 'test-xai-key',
      instructions: 'You are helpful.',
      speaker: 'ara',
    });

    await voice.connect();

    const ws = latestSocket();
    expect(ws.url).toBe('wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0');
    expect(ws.options.headers.Authorization).toBe('Bearer test-xai-key');

    const [sessionUpdate] = sentEvents(ws);
    expect(sessionUpdate).toMatchObject({
      type: 'session.update',
      session: {
        instructions: 'You are helpful.',
        voice: 'ara',
        turn_detection: { type: 'server_vad' },
        audio: {
          input: { format: { type: 'audio/pcm', rate: 24000 } },
          output: { format: { type: 'audio/pcm', rate: 24000 } },
        },
      },
    });
  });

  it('supports xAI ephemeral token websocket protocol auth', async () => {
    voice = new XAIRealtimeVoice({
      ephemeralToken: 'ephemeral-token',
      model: 'grok-voice-think-fast-1.0',
    });

    await voice.connect();

    const ws = latestSocket();
    expect(ws.protocols).toEqual(['xai-client-secret.ephemeral-token']);
    expect(ws.options).toBeUndefined();
  });

  it('prefers ephemeral token auth when both token and API key are configured', async () => {
    voice = new XAIRealtimeVoice({
      apiKey: 'server-key',
      ephemeralToken: 'client-token',
    });

    await voice.connect();

    const ws = latestSocket();
    expect(ws.protocols).toEqual(['xai-client-secret.client-token']);
    expect(ws.options).toBeUndefined();
  });

  it('throws before connect when no xAI auth is configured', async () => {
    const unauthenticatedVoice = new XAIRealtimeVoice();
    await expect(unauthenticatedVoice.connect()).rejects.toThrow('xAI API key is required');
  });

  it('creates text turns and response requests from speak()', async () => {
    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    await voice.speak('Hello Grok');

    expect(sentEvents(ws)).toEqual([
      {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello Grok' }],
        },
      },
      { type: 'response.create' },
    ]);
  });

  it('sends the initial session update before queued pre-connect events', async () => {
    await voice.speak('Queued hello');
    await voice.connect();

    const events = sentEvents();
    expect(events[0].type).toBe('session.update');
    expect(events[1]).toMatchObject({
      type: 'conversation.item.create',
      item: {
        role: 'user',
        content: [{ type: 'input_text', text: 'Queued hello' }],
      },
    });
    expect(events[2]).toEqual({ type: 'response.create' });
  });

  it('deduplicates concurrent connect() calls', async () => {
    await Promise.all([voice.connect(), voice.connect()]);

    expect(sockets()).toHaveLength(1);
    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0].type).toBe('session.update');
  });

  it('rejects connect when the websocket closes before opening', async () => {
    (WebSocket as any).autoOpen = false;

    const connection = voice.connect();
    latestSocket().simulateClose(1006, 'handshake failed');

    await expect(connection).rejects.toThrow('WebSocket closed before opening');
  });

  it('does not queue realtime audio before connect is open', async () => {
    const errors = vi.fn();
    voice.on('error', errors);

    await voice.send(new Int16Array([1, 2]));
    await voice.connect();

    expect(errors).toHaveBeenCalledWith({ message: 'Cannot send audio before connect() is open' });
    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0].type).toBe('session.update');
  });

  it('appends Int16 audio and supports manual commit and clear events', async () => {
    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    await voice.send(new Int16Array([1, -1]));
    await voice.commitAudioBuffer('commit-1');
    await voice.clearAudioBuffer('clear-1');
    await voice.cancelResponse('response-1', 'cancel-1');

    const events = sentEvents(ws);
    expect(events[0]).toMatchObject({
      type: 'input_audio_buffer.append',
      audio: 'AQD//w==',
    });
    expect(events[1]).toEqual({ type: 'input_audio_buffer.commit', event_id: 'commit-1' });
    expect(events[2]).toEqual({ type: 'input_audio_buffer.clear', event_id: 'clear-1' });
    expect(events[3]).toEqual({ type: 'response.cancel', response_id: 'response-1', event_id: 'cancel-1' });
  });

  it('cleans up live audio stream listeners when the provider closes', async () => {
    await voice.connect();
    const stream = new PassThrough();

    await voice.send(stream);

    expect(stream.listenerCount('data')).toBe(1);
    expect(stream.listenerCount('error')).toBe(1);
    expect(stream.listenerCount('end')).toBe(1);
    expect(stream.listenerCount('close')).toBe(1);

    voice.close();

    expect(stream.listenerCount('data')).toBe(0);
    expect(stream.listenerCount('error')).toBe(0);
    expect(stream.listenerCount('end')).toBe(0);
    expect(stream.listenerCount('close')).toBe(0);
  });

  it('emits an error and cleans up when live audio stream chunks are not binary', async () => {
    await voice.connect();
    const stream = new PassThrough({ objectMode: true });
    const errors = vi.fn();
    voice.on('error', errors);

    await voice.send(stream);
    stream.write({ not: 'audio' });

    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Audio stream chunks must be Buffer, ArrayBuffer, or TypedArray values',
      }),
    );
    expect(stream.listenerCount('data')).toBe(0);
    expect(stream.listenerCount('error')).toBe(0);
    expect(stream.listenerCount('end')).toBe(0);
    expect(stream.listenerCount('close')).toBe(0);
  });

  it('listen() sends a finite audio message, commits, and requests a response', async () => {
    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    const stream = new PassThrough();
    stream.end(Buffer.from([1, 2, 3]));

    await voice.listen(stream);

    expect(sentEvents(ws)).toEqual([
      {
        type: 'input_audio_buffer.append',
        audio: 'AQID',
      },
      { type: 'input_audio_buffer.commit' },
      { type: 'response.create' },
    ]);
  });

  it('maps xAI audio, text, transcription, and error events to Mastra events', async () => {
    await voice.connect();
    const ws = latestSocket();

    const speakerPromise = new Promise<any>(resolve => voice.on('speaker', resolve));
    const speaking = vi.fn();
    const writing = vi.fn();
    const errors = vi.fn();
    const done = vi.fn();

    voice.on('speaking', speaking);
    voice.on('writing', writing);
    voice.on('error', errors);
    voice.on('speaking.done', done);

    ws.simulateMessage({ type: 'response.created', response: { id: 'resp_1' } });
    const speakerStream = await speakerPromise;
    expect(speakerStream.id).toBe('resp_1');

    ws.simulateMessage({
      type: 'response.output_audio.delta',
      response_id: 'resp_1',
      delta: Buffer.from('audio').toString('base64'),
    });
    ws.simulateMessage({ type: 'response.text.delta', response_id: 'resp_1', delta: 'Hello' });
    ws.simulateMessage({
      type: 'conversation.item.input_audio_transcription.completed',
      response_id: 'resp_1',
      transcript: 'Hi',
    });
    ws.simulateMessage({ type: 'response.output_audio.done', response_id: 'resp_1' });
    ws.simulateMessage({ type: 'error', error: { message: 'bad request', code: 'invalid_request' } });

    expect(speaking).toHaveBeenCalledWith({
      audio: Buffer.from('audio').toString('base64'),
      audioData: Buffer.from('audio'),
      response_id: 'resp_1',
    });
    expect(writing).toHaveBeenCalledWith({ text: 'Hello', response_id: 'resp_1', role: 'assistant' });
    expect(writing).toHaveBeenCalledWith({ text: 'Hi', response_id: 'resp_1', role: 'user' });
    expect(done).toHaveBeenCalledWith({ response_id: 'resp_1' });
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'bad request',
        code: 'invalid_request',
      }),
    );
  });

  it('ends speaker streams for text-only responses on response.done', async () => {
    await voice.connect();
    const ws = latestSocket();

    const speakerPromise = new Promise<any>(resolve => voice.on('speaker', resolve));
    ws.simulateMessage({ type: 'response.created', response: { id: 'resp_text_only' } });
    const speakerStream = await speakerPromise;
    const ended = new Promise<void>(resolve => speakerStream.on('end', resolve));
    speakerStream.resume();

    ws.simulateMessage({ type: 'response.done', response: { id: 'resp_text_only' } });

    await ended;
  });

  it('transforms Mastra tools and waits for parallel function calls before continuing', async () => {
    const weatherExecute = vi.fn().mockResolvedValue({ temperature: 22 });
    const calendarExecute = vi.fn().mockResolvedValue({ available: true });

    voice.addTools({
      getWeather: {
        id: 'getWeather',
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
        execute: weatherExecute,
      },
      checkCalendar: {
        id: 'checkCalendar',
        description: 'Check calendar',
        inputSchema: z.object({ date: z.string() }),
        execute: calendarExecute,
      },
    });

    await voice.connect({ requestContext: { userId: 'user-1' } as any });
    const ws = latestSocket();
    const initialSessionUpdate = sentEvents(ws)[0];
    expect(initialSessionUpdate.session.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        name: 'getWeather',
        parameters: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            location: expect.objectContaining({ type: 'string' }),
          }),
          required: ['location'],
        }),
      }),
      expect.objectContaining({
        type: 'function',
        name: 'checkCalendar',
        parameters: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            date: expect.objectContaining({ type: 'string' }),
          }),
          required: ['date'],
        }),
      }),
    ]);

    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_tools',
      call_id: 'call_weather',
      name: 'getWeather',
      arguments: JSON.stringify({ location: 'Paris' }),
    });
    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_tools',
      call_id: 'call_calendar',
      name: 'checkCalendar',
      arguments: JSON.stringify({ date: '2026-05-12' }),
    });

    await waitForAsync();

    expect(weatherExecute).toHaveBeenCalledWith(
      { location: 'Paris' },
      expect.objectContaining({
        toolCallId: 'call_weather',
        requestContext: { userId: 'user-1' },
      }),
    );
    expect(calendarExecute).toHaveBeenCalledWith(
      { date: '2026-05-12' },
      expect.objectContaining({
        toolCallId: 'call_calendar',
        requestContext: { userId: 'user-1' },
      }),
    );

    let events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'conversation.item.create')).toHaveLength(2);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(0);

    ws.simulateMessage({ type: 'response.done', response: { id: 'resp_tools' } });
    await waitForAsync();

    events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(1);
  });

  it('continues when response.done is received before a function call event', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    voice.addTools({
      lookup: {
        id: 'lookup',
        description: 'Lookup data',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });

    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.done',
      response: {
        id: 'resp_done_first',
        output: [{ type: 'function_call', call_id: 'call_lookup', name: 'lookup' }],
      },
    });
    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_done_first',
      call_id: 'call_lookup',
      name: 'lookup',
      arguments: JSON.stringify({ id: '123' }),
    });
    await waitForAsync();

    const events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'conversation.item.create')).toHaveLength(1);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(1);
  });

  it('waits for every function call listed in a done-first response', async () => {
    const firstExecute = vi.fn().mockResolvedValue({ first: true });
    const secondExecute = vi.fn().mockResolvedValue({ second: true });
    voice.addTools({
      first: {
        id: 'first',
        description: 'First tool',
        inputSchema: z.object({ id: z.string() }),
        execute: firstExecute,
      },
      second: {
        id: 'second',
        description: 'Second tool',
        inputSchema: z.object({ id: z.string() }),
        execute: secondExecute,
      },
    });

    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.done',
      response: {
        id: 'resp_multi_done_first',
        output: [
          { type: 'function_call', call_id: 'call_first', name: 'first' },
          { type: 'function_call', call_id: 'call_second', name: 'second' },
        ],
      },
    });
    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_multi_done_first',
      call_id: 'call_first',
      name: 'first',
      arguments: JSON.stringify({ id: '1' }),
    });
    await waitForAsync();

    let events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'conversation.item.create')).toHaveLength(1);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(0);

    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_multi_done_first',
      call_id: 'call_second',
      name: 'second',
      arguments: JSON.stringify({ id: '2' }),
    });
    await waitForAsync();

    events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'conversation.item.create')).toHaveLength(2);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(1);
  });

  it('times out missing function call arguments from a done-first response', async () => {
    await voice.connect();
    const ws = latestSocket();
    const errors = vi.fn();
    voice.on('error', errors);
    ws.send.mockClear();

    try {
      vi.useFakeTimers();

      ws.simulateMessage({
        type: 'response.done',
        response: {
          id: 'resp_missing_args',
          output: [{ type: 'function_call', call_id: 'call_missing', name: 'missing' }],
        },
      });

      await vi.advanceTimersByTimeAsync(30_000);
    } finally {
      vi.useRealTimers();
    }

    const events = sentEvents(ws);
    expect(events).toContainEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_missing',
        output: expect.stringContaining('Timed out waiting for xAI function call arguments'),
      },
    });
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(1);
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Timed out waiting for xAI function call arguments'),
        details: { response_id: 'resp_missing_args', call_ids: ['call_missing'] },
      }),
    );
  });

  it('emits parse diagnostics for malformed function call arguments', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const errors = vi.fn();
    voice.on('error', errors);
    voice.addTools({
      lookup: {
        id: 'lookup',
        description: 'Lookup data',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });

    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_malformed_args',
      call_id: 'call_lookup',
      name: 'lookup',
      arguments: '{bad json',
    });
    await waitForAsync();

    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to parse xAI function call arguments'),
        details: expect.objectContaining({
          call_id: 'call_lookup',
          name: 'lookup',
          arguments: '{bad json',
          error: expect.any(SyntaxError),
        }),
      }),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(sentEvents(ws)).toContainEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_lookup',
        output: expect.stringContaining('Failed to parse xAI function call arguments'),
      },
    });
  });

  it('serializes undefined tool results as null function outputs', async () => {
    voice.addTools({
      sideEffect: {
        id: 'sideEffect',
        description: 'Run side effect',
        inputSchema: z.object({ id: z.string() }),
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });

    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_void',
      call_id: 'call_void',
      name: 'sideEffect',
      arguments: JSON.stringify({ id: '123' }),
    });
    await waitForAsync();

    expect(sentEvents(ws)).toContainEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_void',
        output: 'null',
      },
    });
  });

  it('sends function error outputs and waits for response.done before continuing', async () => {
    voice.addTools({
      failTool: {
        id: 'failTool',
        description: 'Fails',
        inputSchema: z.object({ value: z.string() }),
        execute: vi.fn().mockRejectedValue(new Error('tool failed')),
      },
    });

    await voice.connect();
    const ws = latestSocket();
    const errors = vi.fn();
    voice.on('error', errors);
    ws.send.mockClear();

    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_fail',
      call_id: 'call_fail',
      name: 'failTool',
      arguments: JSON.stringify({ value: 'x' }),
    });
    await waitForAsync();

    let events = sentEvents(ws);
    expect(events).toContainEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_fail',
        output: JSON.stringify({ error: 'tool failed' }),
      },
    });
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(0);
    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: 'tool failed' }));

    ws.simulateMessage({ type: 'response.done', response: { id: 'resp_fail' } });
    await waitForAsync();

    events = sentEvents(ws);
    expect(events.filter((event: any) => event.type === 'response.create')).toHaveLength(1);
  });

  it('clears queued events and request context on close before reconnect', async () => {
    await voice.speak('queued before close');
    voice.close();
    await voice.connect();

    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0].type).toBe('session.update');
  });

  it('clears request context and pending state on unexpected websocket close', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    voice.addTools({
      lookup: {
        id: 'lookup',
        description: 'Lookup data',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });

    await voice.connect({ requestContext: { userId: 'old-user' } as any });
    latestSocket().simulateClose();
    await voice.connect();

    const ws = latestSocket();
    ws.send.mockClear();
    ws.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_reconnect',
      call_id: 'call_lookup',
      name: 'lookup',
      arguments: JSON.stringify({ id: 'abc' }),
    });
    await waitForAsync();

    expect(execute).toHaveBeenCalledWith(
      { id: 'abc' },
      expect.objectContaining({
        toolCallId: 'call_lookup',
        requestContext: undefined,
      }),
    );
  });

  it('ignores stale close events from a previous websocket after reconnect', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const onError = vi.fn();
    voice.addTools({
      lookup: {
        id: 'lookup',
        description: 'Lookup data',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });
    voice.on('error', onError);

    await voice.connect({ requestContext: { userId: 'old-user' } as any });
    const oldWs = latestSocket();
    (voice as any).state = 'closed';

    await voice.connect({ requestContext: { userId: 'new-user' } as any });
    const newWs = latestSocket();
    oldWs.simulateClose();
    oldWs.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_stale',
      call_id: 'call_stale',
      name: 'lookup',
      arguments: JSON.stringify({ id: 'stale' }),
    });
    oldWs.emit('error', new Error('stale socket error'));
    await waitForAsync();
    expect(execute).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    newWs.send.mockClear();

    newWs.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_current',
      call_id: 'call_lookup',
      name: 'lookup',
      arguments: JSON.stringify({ id: 'abc' }),
    });
    await waitForAsync();

    expect(execute).toHaveBeenCalledWith(
      { id: 'abc' },
      expect.objectContaining({
        toolCallId: 'call_lookup',
        requestContext: { userId: 'new-user' },
      }),
    );
    expect(sentEvents(newWs).some((event: any) => event.item?.call_id === 'call_lookup')).toBe(true);
  });

  it('drops stale function outputs after an unexpected websocket close', async () => {
    let resolveTool: (value: unknown) => void = () => {};
    const execute = vi.fn(
      () =>
        new Promise(resolve => {
          resolveTool = resolve;
        }),
    );
    voice.addTools({
      slowLookup: {
        id: 'slowLookup',
        description: 'Slow lookup',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });

    await voice.connect();
    const oldWs = latestSocket();
    oldWs.send.mockClear();

    oldWs.simulateMessage({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_stale',
      call_id: 'call_stale',
      name: 'slowLookup',
      arguments: JSON.stringify({ id: 'abc' }),
    });
    await waitForAsync();
    oldWs.simulateClose();

    resolveTool({ ok: true });
    await waitForAsync();
    await voice.connect();

    const newEvents = sentEvents(latestSocket());
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0].type).toBe('session.update');
    expect(newEvents.some((event: any) => event.item?.call_id === 'call_stale')).toBe(false);
  });

  it('can clear instructions with a session update', async () => {
    await voice.connect();
    const ws = latestSocket();
    ws.send.mockClear();

    voice.addInstructions(undefined);

    expect(sentEvents(ws)).toEqual([{ type: 'session.update', session: { instructions: '' } }]);
  });

  it('keeps cleared instructions for the next connection', async () => {
    voice = new XAIRealtimeVoice({
      apiKey: 'test-xai-key',
      instructions: 'old instructions',
    });

    voice.addInstructions(undefined);
    await voice.connect();

    expect(sentEvents()[0].session.instructions).toBe('');
  });

  it('emits an error when sending events after explicit close', async () => {
    await voice.connect();
    const errors = vi.fn();
    voice.on('error', errors);

    voice.close();
    await voice.answer();

    expect(errors).toHaveBeenCalledWith({ message: 'Cannot send event after close()' });
  });

  it('emits close when close() is called explicitly', async () => {
    await voice.connect();
    const closed = vi.fn();
    voice.on('close', closed);

    voice.close();

    expect(closed).toHaveBeenCalledWith({ code: 1000, reason: 'closed' });
  });

  it('passes xAI server-side tools through session configuration', async () => {
    voice = new XAIRealtimeVoice({
      apiKey: 'test-xai-key',
      session: {
        tools: [{ type: 'web_search' }],
      },
      serverTools: [
        { type: 'x_search', allowed_x_handles: ['xai'] },
        { type: 'file_search', vector_store_ids: ['collection_123'], max_num_results: 5 },
        {
          type: 'mcp',
          server_url: 'https://mcp.example.com/mcp',
          server_label: 'business',
          server_description: 'Business tools',
          allowed_tools: ['lookup_order'],
          authorization: 'Bearer token',
          headers: { 'X-Tenant': 'tenant-1' },
        },
      ],
    });

    await voice.connect();

    expect(sentEvents()[0].session.tools).toEqual([
      { type: 'web_search' },
      { type: 'x_search', allowed_x_handles: ['xai'] },
      { type: 'file_search', vector_store_ids: ['collection_123'], max_num_results: 5 },
      {
        type: 'mcp',
        server_url: 'https://mcp.example.com/mcp',
        server_label: 'business',
        server_description: 'Business tools',
        allowed_tools: ['lookup_order'],
        authorization: 'Bearer token',
        headers: { 'X-Tenant': 'tenant-1' },
      },
    ]);
  });

  it('strips circular session config values instead of throwing during serialization', async () => {
    await voice.connect();
    const ws = latestSocket();
    const circular: Record<string, unknown> = { enabled: true };
    circular.self = circular;
    ws.send.mockClear();

    expect(() => voice.updateConfig({ metadata: circular } as any)).not.toThrow();

    expect(sentEvents(ws)[0]).toEqual({
      type: 'session.update',
      session: {
        metadata: {
          enabled: true,
        },
      },
    });
  });

  it('preserves binary values when stripping undefined fields', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const stripped = (voice as any).stripUndefined({ metadata: { bytes, optional: undefined } });

    expect(stripped).toEqual({
      metadata: {
        bytes,
      },
    });
    expect(stripped.metadata.bytes).toBe(bytes);
  });

  it('does not leak API keys through serializeForSpan()', () => {
    const serialized = JSON.stringify(
      new XAIRealtimeVoice({
        apiKey: 'secret-xai-key',
        model: 'grok-voice-think-fast-1.0',
      }).serializeForSpan(),
    );

    expect(serialized).toContain('grok-voice-think-fast-1.0');
    expect(serialized).not.toContain('secret-xai-key');
  });
});
