import { PassThrough } from 'node:stream';
import { MastraVoice } from '@internal/voice';
import type { RequestContext, ToolsInput, VoiceConfig, VoiceEventType } from '@internal/voice';
import type { WebSocket as WSType } from 'ws';
import { WebSocket } from 'ws';
import type {
  XAIClientEvent,
  XAIRealtimeAnswerOptions,
  XAIRealtimeEventMap,
  XAIRealtimeListenOptions,
  XAIRealtimeModel,
  XAIRealtimeSpeakOptions,
  XAIRealtimeVoiceConfig,
  XAIServerEvent,
  XAISessionConfig,
  XAISpeaker,
  XAITurnDetection,
  XAITool,
  XAIVoice,
} from './types';
import type { XAIExecuteFunction, XAITransformedTool } from './utils';
import { int16ArrayToBase64, isReadableStream, readableToBase64, transformTools } from './utils';

export type {
  XAIAudioConfig,
  XAIAudioFormat,
  XAIAudioFormatType,
  XAIFunctionTool,
  XAIRealtimeAnswerOptions,
  XAIRealtimeEventMap,
  XAIRealtimeListenOptions,
  XAIRealtimeModel,
  XAIRealtimeSpeakOptions,
  XAIRealtimeVoiceConfig,
  XAIServerTool,
  XAISessionConfig,
  XAISpeaker,
  XAITool,
  XAITurnDetection,
  XAIVoice,
} from './types';

type EventCallback = (...args: any[]) => void;
type StreamWithId = PassThrough & { id: string };
type ConnectionState = 'closed' | 'connecting' | 'open';

const DEFAULT_URL = 'wss://api.x.ai/v1/realtime';
const DEFAULT_MODEL: XAIRealtimeModel = 'grok-voice-think-fast-1.0';
const DEFAULT_VOICE: XAIVoice = 'eve';

const DEFAULT_TURN_DETECTION: XAITurnDetection = {
  type: 'server_vad',
};
const FUNCTION_CALL_ARGUMENT_TIMEOUT_MS = 30_000;

const DEFAULT_AUDIO = {
  input: { format: { type: 'audio/pcm' as const, rate: 24000 as const } },
  output: { format: { type: 'audio/pcm' as const, rate: 24000 as const } },
};

const XAI_SPEAKERS: XAISpeaker[] = [
  {
    voiceId: 'eve',
    name: 'Eve',
    gender: 'female',
    description: 'Energetic, upbeat default voice.',
  },
  {
    voiceId: 'ara',
    name: 'Ara',
    gender: 'female',
    description: 'Warm, friendly conversational voice.',
  },
  {
    voiceId: 'rex',
    name: 'Rex',
    gender: 'male',
    description: 'Confident, clear professional voice.',
  },
  {
    voiceId: 'sal',
    name: 'Sal',
    gender: 'neutral',
    description: 'Smooth, balanced general-purpose voice.',
  },
  {
    voiceId: 'leo',
    name: 'Leo',
    gender: 'male',
    description: 'Authoritative, strong instructional voice.',
  },
];

interface PendingFunctionResponse {
  pending: Set<Promise<void>>;
  expectedCallIds: Set<string>;
  startedCallIds: Set<string>;
  completedCallIds: Set<string>;
  missingCallTimeout?: ReturnType<typeof setTimeout>;
  sessionGeneration: number;
  responseDone: boolean;
  continuationSent: boolean;
  hasFunctionCall: boolean;
}

interface FunctionCallEvent {
  responseId: string;
  callId: string;
  name: string;
  arguments: string;
  sessionGeneration: number;
}

type ParsedFunctionArguments = { ok: true; value: unknown } | { ok: false; rawArguments: string; error: SyntaxError };

/**
 * Realtime Grok Voice Agent API provider for Mastra.
 *
 * This provider follows Mastra's realtime voice contract while keeping xAI's
 * endpoint, authentication, voices, event names, and tool behavior explicit.
 */
export class XAIRealtimeVoice extends MastraVoice<
  XAIRealtimeVoiceConfig,
  XAIRealtimeSpeakOptions,
  XAIRealtimeListenOptions,
  ToolsInput,
  XAIRealtimeEventMap,
  XAISpeaker
> {
  private ws?: WSType;
  private state: ConnectionState = 'closed';
  private readonly events = new Map<string, EventCallback[]>();
  private readonly queue: XAIClientEvent[] = [];
  private readonly speakerStreams = new Map<string, StreamWithId>();
  private readonly functionResponses = new Map<string, PendingFunctionResponse>();
  private readonly audioStreamCleanups = new Set<() => void>();
  private requestContext?: RequestContext;
  private instructions?: string;
  private tools?: ToolsInput;
  private transformedTools?: XAITransformedTool[];
  private readonly options: XAIRealtimeVoiceConfig;
  private readonly debug: boolean;
  private closedByUser = false;
  private connectPromise?: Promise<void>;
  private sessionGeneration = 0;
  private fallbackResponseCounter = 0;

  constructor(config: VoiceConfig<XAIRealtimeVoiceConfig> | XAIRealtimeVoiceConfig = {}) {
    const normalizedConfig = XAIRealtimeVoice.normalizeConfig(config);
    super(normalizedConfig);

    this.options = normalizedConfig.realtimeConfig?.options || {};
    this.instructions = this.options.instructions;
    this.speaker = normalizedConfig.speaker || this.options.speaker || DEFAULT_VOICE;
    this.debug = this.options.debug || false;
  }

  private static normalizeConfig(
    config: VoiceConfig<XAIRealtimeVoiceConfig> | XAIRealtimeVoiceConfig,
  ): VoiceConfig<XAIRealtimeVoiceConfig> {
    if ('realtimeConfig' in config || 'speechModel' in config || 'listeningModel' in config) {
      const voiceConfig = config as VoiceConfig<XAIRealtimeVoiceConfig>;
      const options = voiceConfig.realtimeConfig?.options || {};
      return {
        ...voiceConfig,
        speaker: voiceConfig.speaker || options.speaker || DEFAULT_VOICE,
        realtimeConfig: {
          model: voiceConfig.realtimeConfig?.model || options.model || DEFAULT_MODEL,
          apiKey: voiceConfig.realtimeConfig?.apiKey || options.apiKey,
          options,
        },
      };
    }

    const xaiConfig = config as XAIRealtimeVoiceConfig;
    return {
      speaker: xaiConfig.speaker || DEFAULT_VOICE,
      realtimeConfig: {
        model: xaiConfig.model || DEFAULT_MODEL,
        apiKey: xaiConfig.apiKey,
        options: xaiConfig,
      },
    };
  }

  getSpeakers(): Promise<XAISpeaker[]> {
    return Promise.resolve(XAI_SPEAKERS);
  }

  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }

  addInstructions(instructions?: string): void {
    this.instructions = instructions ?? '';
    if (this.state === 'open') {
      this.updateConfig({ instructions: this.instructions });
    }
  }

  addTools(tools?: ToolsInput): void {
    this.tools = tools || {};
    this.transformedTools = undefined;
    if (this.state === 'open') {
      this.updateConfig({ tools: this.buildSessionTools() });
    }
  }

  updateConfig(sessionConfig: Partial<XAISessionConfig>): void {
    this.sendEvent({
      type: 'session.update',
      session: this.stripUndefined(sessionConfig) as XAISessionConfig,
    });
  }

  async connect({ requestContext }: { requestContext?: RequestContext } = {}): Promise<void> {
    if (this.state === 'open') {
      return;
    }

    if (this.state === 'connecting' && this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.openConnection({ requestContext });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  private async openConnection({ requestContext }: { requestContext?: RequestContext } = {}): Promise<void> {
    const apiKey = this.options.apiKey || this.realtimeConfig?.apiKey || process.env.XAI_API_KEY;
    const ephemeralToken = this.options.ephemeralToken;

    if (!apiKey && !ephemeralToken) {
      throw new Error('xAI API key is required. Set XAI_API_KEY, pass apiKey, or pass ephemeralToken.');
    }

    this.requestContext = requestContext;
    this.closedByUser = false;
    this.state = 'connecting';
    this.sessionGeneration += 1;

    const url = this.buildUrl();
    const protocols = ephemeralToken ? [`xai-client-secret.${ephemeralToken}`] : undefined;
    const wsOptions =
      !ephemeralToken && apiKey
        ? {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        : undefined;

    const ws = new WebSocket(url, protocols, wsOptions);
    this.ws = ws;
    this.setupEventListeners(ws);

    try {
      await this.waitForOpen(ws);
      this.state = 'open';
      this.updateConfig(this.buildInitialSessionConfig());
      this.flushQueue();
    } catch (err) {
      this.cleanupSessionState();
      this.state = 'closed';
      this.ws = undefined;
      ws.close();
      throw err;
    }
  }

  close(): void {
    const ws = this.ws;
    this.state = 'closed';
    this.closedByUser = true;
    this.connectPromise = undefined;
    this.ws = undefined;
    this.cleanupSessionState();
    ws?.close();
    if (ws) {
      this.emit('close', { code: 1000, reason: 'closed' });
    }
  }

  disconnect(): void {
    this.close();
  }

  async speak(input: string | NodeJS.ReadableStream, options: XAIRealtimeSpeakOptions = {}): Promise<void> {
    const text = typeof input === 'string' ? input : (await this.readInputStream(input)).toString('utf-8');

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    if (options.speaker && options.speaker !== this.speaker) {
      this.speaker = options.speaker;
      this.updateConfig({ voice: options.speaker });
    }

    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });

    await this.answer({ response: options.response });
  }

  async listen(audioData: NodeJS.ReadableStream | unknown, options: XAIRealtimeListenOptions = {}): Promise<void> {
    if (!isReadableStream(audioData)) {
      this.emit('error', { message: 'Unsupported audio data format' });
      return;
    }

    this.appendAudio(await readableToBase64(audioData));

    if (options.commit ?? true) {
      await this.commitAudioBuffer();
    }

    if (options.createResponse ?? true) {
      await this.answer({ response: options.response });
    }
  }

  async send(audioData: NodeJS.ReadableStream | Int16Array, eventId?: string): Promise<void> {
    if (this.state !== 'open' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', { message: 'Cannot send audio before connect() is open' });
      return;
    }

    if (isReadableStream(audioData)) {
      const cleanup = () => {
        audioData.removeListener('data', onData);
        audioData.removeListener('error', onError);
        audioData.removeListener('end', onEnd);
        audioData.removeListener('close', onEnd);
        this.audioStreamCleanups.delete(cleanup);
      };
      const onData = (chunk: unknown) => {
        try {
          const buffer = this.normalizeAudioChunk(chunk);
          this.appendAudio(buffer.toString('base64'), eventId);
        } catch (err) {
          this.emitError(err);
          cleanup();
        }
      };
      const onError = (err: Error) => {
        this.emitError(err);
        cleanup();
      };
      const onEnd = () => cleanup();

      this.audioStreamCleanups.add(cleanup);
      audioData.on('data', onData);
      audioData.on('error', onError);
      audioData.on('end', onEnd);
      audioData.on('close', onEnd);
      return;
    }

    if (audioData instanceof Int16Array) {
      this.appendAudio(int16ArrayToBase64(audioData), eventId);
      return;
    }

    this.emit('error', { message: 'Unsupported audio data format' });
  }

  async commitAudioBuffer(eventId?: string): Promise<void> {
    this.sendEvent({ type: 'input_audio_buffer.commit', event_id: eventId });
  }

  async clearAudioBuffer(eventId?: string): Promise<void> {
    this.sendEvent({ type: 'input_audio_buffer.clear', event_id: eventId });
  }

  async cancelResponse(responseId?: string, eventId?: string): Promise<void> {
    this.sendEvent({ type: 'response.cancel', response_id: responseId, event_id: eventId });
  }

  async answer(options: XAIRealtimeAnswerOptions = {}): Promise<void> {
    this.sendEvent({
      type: 'response.create',
      ...(options.response ? { response: options.response } : {}),
    });
  }

  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof XAIRealtimeEventMap ? XAIRealtimeEventMap[E] : unknown) => void,
  ): void {
    const callbacks = this.events.get(event) || [];
    callbacks.push(callback as EventCallback);
    this.events.set(event, callbacks);
  }

  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof XAIRealtimeEventMap ? XAIRealtimeEventMap[E] : unknown) => void,
  ): void {
    const callbacks = this.events.get(event);
    if (!callbacks) {
      return;
    }

    const index = callbacks.indexOf(callback as EventCallback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  private buildUrl(): string {
    const baseUrl = this.options.url || DEFAULT_URL;
    const url = new URL(baseUrl);
    url.searchParams.set('model', this.realtimeConfig?.model || this.options.model || DEFAULT_MODEL);
    return url.toString();
  }

  private buildInitialSessionConfig(): XAISessionConfig {
    const session = this.options.session || {};
    return this.stripUndefined({
      ...session,
      instructions: this.instructions,
      voice: this.speaker as XAIVoice,
      turn_detection: session.turn_detection ?? this.options.turnDetection ?? DEFAULT_TURN_DETECTION,
      audio: session.audio ?? this.options.audio ?? DEFAULT_AUDIO,
      tools: this.buildSessionTools(),
    }) as XAISessionConfig;
  }

  private buildSessionTools(): XAITool[] {
    const serverTools = [...(this.options.session?.tools || []), ...(this.options.serverTools || [])];
    const functionTools = this.getTransformedTools().map(tool => tool.xaiTool);
    return [...serverTools, ...functionTools];
  }

  private getTransformedTools(): XAITransformedTool[] {
    this.transformedTools ??= transformTools(this.tools, this.logger);
    return this.transformedTools;
  }

  private setupEventListeners(ws: WSType): void {
    ws.on('message', message => {
      if (this.ws !== ws) {
        return;
      }

      try {
        const event = JSON.parse(message.toString()) as XAIServerEvent;
        this.handleServerEvent(event);
      } catch (err) {
        this.emitError(err);
      }
    });

    ws.on('error', err => {
      if (this.ws !== ws) {
        return;
      }

      if (this.state === 'open') {
        this.emitError(err);
      }
    });

    ws.on('close', (code, reason) => {
      if (this.ws !== ws) {
        return;
      }

      this.state = 'closed';
      this.ws = undefined;
      this.connectPromise = undefined;
      this.cleanupSessionState();
      this.emit('close', { code, reason: reason?.toString?.() });
    });
  }

  private handleServerEvent(event: XAIServerEvent): void {
    if (this.debug) {
      const { delta, ...fields } = event;
      this.logger.debug(`[xAI realtime] ${event.type}`, { ...fields, deltaLength: delta?.length });
    }

    if (event.type !== 'error') {
      this.emit(event.type, event);
    }

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
      case 'response.created':
        if (event.type === 'response.created') {
          this.createSpeakerStream(this.getResponseId(event));
        }
        return;
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        this.handleAudioDelta(event);
        return;
      case 'response.output_audio.done':
      case 'response.audio.done':
        this.handleAudioDone(event);
        return;
      case 'response.text.delta':
      case 'response.output_text.delta':
      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        this.emit('writing', { text: event.delta || '', response_id: this.getResponseId(event), role: 'assistant' });
        return;
      case 'response.text.done':
      case 'response.output_text.done':
      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
        this.emit('writing', { text: '\n', response_id: this.getResponseId(event), role: 'assistant' });
        return;
      case 'conversation.item.input_audio_transcription.completed':
      case 'conversation.item.input_audio_transcription.done':
        this.emit('writing', {
          text: event.transcript || event.text || event.delta || '',
          response_id: this.getResponseId(event),
          role: 'user',
        });
        return;
      case 'response.function_call_arguments.done':
        this.handleFunctionCallEvent(event);
        return;
      case 'response.done':
        void this.handleResponseDone(event);
        return;
      case 'error':
        this.emit('error', {
          message: event.error?.message || 'xAI realtime error',
          code: event.error?.code || event.error?.type,
          details: event,
        });
        return;
      default:
        return;
    }
  }

  private handleAudioDelta(event: XAIServerEvent): void {
    const responseId = this.getResponseId(event);
    const audio = event.delta || '';
    const audioData = Buffer.from(audio, 'base64');
    const stream = this.createSpeakerStream(responseId);
    stream.write(audioData);
    this.emit('speaking', { audio, audioData, response_id: responseId });
  }

  private handleAudioDone(event: XAIServerEvent): void {
    const responseId = this.getResponseId(event);
    this.emit('speaking.done', { response_id: responseId });
    this.endSpeakerStream(responseId);
  }

  private handleFunctionCallEvent(event: XAIServerEvent): void {
    const call = this.normalizeFunctionCallEvent(event);
    if (!call) {
      this.emit('error', {
        message: 'Invalid xAI function call event',
        details: event,
      });
      return;
    }

    const state = this.getFunctionResponseState(call.responseId);
    state.hasFunctionCall = true;
    state.expectedCallIds.add(call.callId);

    if (state.startedCallIds.has(call.callId)) {
      return;
    }

    state.startedCallIds.add(call.callId);
    const pending = this.executeFunctionCall(call).finally(() => {
      state.completedCallIds.add(call.callId);
      state.pending.delete(pending);
      void this.maybeContinueAfterFunctionCalls(call.responseId);
    });

    state.pending.add(pending);
  }

  private async handleResponseDone(event: XAIServerEvent): Promise<void> {
    const responseId = this.getResponseId(event);
    this.endSpeakerStream(responseId);

    const expectedCallIds = this.getFunctionCallIds(event);
    const state =
      this.functionResponses.get(responseId) ||
      (expectedCallIds.length > 0 ? this.getFunctionResponseState(responseId) : undefined);

    if (!state) {
      return;
    }

    for (const callId of expectedCallIds) {
      state.expectedCallIds.add(callId);
    }

    state.hasFunctionCall ||= expectedCallIds.length > 0;
    state.responseDone = true;
    await this.maybeContinueAfterFunctionCalls(responseId);
  }

  private getFunctionCallIds(event: XAIServerEvent): string[] {
    return (
      event.response?.output
        ?.filter(output => output.type === 'function_call' && typeof output.call_id === 'string')
        .map(output => output.call_id as string) || []
    );
  }

  private async executeFunctionCall(call: FunctionCallEvent): Promise<void> {
    const tool = this.tools?.[call.name];
    const parsedArgs = this.parseFunctionArguments(call.arguments);
    if (!parsedArgs.ok) {
      if (!this.isCurrentSession(call.sessionGeneration)) {
        return;
      }

      const message = `Failed to parse xAI function call arguments: ${parsedArgs.error.message}`;
      this.sendFunctionOutput(call.callId, { error: message });
      this.emit('error', {
        message,
        details: {
          call_id: call.callId,
          name: call.name,
          arguments: parsedArgs.rawArguments,
          error: parsedArgs.error,
        },
      });
      return;
    }

    const args = parsedArgs.value;

    try {
      if (!tool?.execute) {
        throw new Error(`Tool "${call.name}" not found`);
      }

      this.emit('tool-call-start', {
        toolCallId: call.callId,
        toolName: call.name,
        toolDescription: tool.description,
        args,
      });

      const result = await this.executeTool(call.name, call.callId, args);

      if (!this.isCurrentSession(call.sessionGeneration)) {
        return;
      }

      this.emit('tool-call-result', {
        toolCallId: call.callId,
        toolName: call.name,
        toolDescription: tool.description,
        args,
        result,
      });

      this.sendFunctionOutput(call.callId, result);
    } catch (err) {
      if (!this.isCurrentSession(call.sessionGeneration)) {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      this.sendFunctionOutput(call.callId, { error: message });
      this.emit('error', {
        message,
        details: { call_id: call.callId, name: call.name },
      });
    }
  }

  private async executeTool(name: string, callId: string, args: unknown): Promise<unknown> {
    const transformedTool = this.getTransformedTools().find(tool => tool.xaiTool.name === name);

    if (!transformedTool) {
      throw new Error(`Tool "${name}" not found`);
    }

    return (transformedTool.execute as XAIExecuteFunction)(args, {
      toolCallId: callId,
      requestContext: this.requestContext,
    });
  }

  private sendFunctionOutput(callId: string, output: unknown): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output ?? null),
      },
    });
  }

  private isCurrentSession(sessionGeneration: number): boolean {
    return this.state === 'open' && this.sessionGeneration === sessionGeneration;
  }

  private async maybeContinueAfterFunctionCalls(responseId: string): Promise<void> {
    const state = this.functionResponses.get(responseId);
    const hasPendingExpectedCall =
      state?.expectedCallIds && [...state.expectedCallIds].some(callId => !state.completedCallIds.has(callId));

    if (state && hasPendingExpectedCall) {
      this.scheduleMissingFunctionCallTimeout(responseId, state);
    }

    if (
      !state ||
      !state.hasFunctionCall ||
      state.continuationSent ||
      !state.responseDone ||
      state.pending.size > 0 ||
      hasPendingExpectedCall
    ) {
      return;
    }

    state.continuationSent = true;
    this.clearMissingFunctionCallTimeout(state);
    this.sendEvent({ type: 'response.create' });
    this.functionResponses.delete(responseId);
  }

  private scheduleMissingFunctionCallTimeout(responseId: string, state: PendingFunctionResponse): void {
    if (state.missingCallTimeout || !state.responseDone) {
      return;
    }

    state.missingCallTimeout = setTimeout(() => {
      if (!this.isCurrentSession(state.sessionGeneration) || this.functionResponses.get(responseId) !== state) {
        return;
      }

      state.missingCallTimeout = undefined;
      const missingCallIds = [...state.expectedCallIds].filter(callId => !state.startedCallIds.has(callId));
      if (missingCallIds.length === 0) {
        void this.maybeContinueAfterFunctionCalls(responseId);
        return;
      }

      const message = `Timed out waiting for xAI function call arguments for ${missingCallIds.join(', ')}`;
      for (const callId of missingCallIds) {
        state.completedCallIds.add(callId);
        this.sendFunctionOutput(callId, { error: message });
      }
      this.emit('error', { message, details: { response_id: responseId, call_ids: missingCallIds } });
      void this.maybeContinueAfterFunctionCalls(responseId);
    }, FUNCTION_CALL_ARGUMENT_TIMEOUT_MS);
  }

  private clearMissingFunctionCallTimeout(state: PendingFunctionResponse): void {
    if (state.missingCallTimeout) {
      clearTimeout(state.missingCallTimeout);
      state.missingCallTimeout = undefined;
    }
  }

  private getFunctionResponseState(responseId: string): PendingFunctionResponse {
    let state = this.functionResponses.get(responseId);
    if (!state) {
      state = {
        pending: new Set(),
        expectedCallIds: new Set(),
        startedCallIds: new Set(),
        completedCallIds: new Set(),
        sessionGeneration: this.sessionGeneration,
        responseDone: false,
        continuationSent: false,
        hasFunctionCall: false,
      };
      this.functionResponses.set(responseId, state);
    }
    return state;
  }

  private normalizeFunctionCallEvent(event: XAIServerEvent): FunctionCallEvent | undefined {
    if (!event.call_id || !event.name || typeof event.arguments !== 'string') {
      return undefined;
    }

    return {
      responseId: this.getResponseId(event),
      callId: event.call_id,
      name: event.name,
      arguments: event.arguments,
      sessionGeneration: this.sessionGeneration,
    };
  }

  private parseFunctionArguments(args: string): ParsedFunctionArguments {
    try {
      return { ok: true, value: JSON.parse(args || '{}') };
    } catch (err) {
      return { ok: false, rawArguments: args, error: err as SyntaxError };
    }
  }

  private appendAudio(audio: string, eventId?: string): void {
    this.sendEvent({ type: 'input_audio_buffer.append', audio, event_id: eventId });
  }

  private normalizeAudioChunk(chunk: unknown): Buffer {
    if (Buffer.isBuffer(chunk)) {
      return chunk;
    }

    if (chunk instanceof ArrayBuffer) {
      return Buffer.from(chunk);
    }

    if (ArrayBuffer.isView(chunk)) {
      return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }

    throw new TypeError('Audio stream chunks must be Buffer, ArrayBuffer, or TypedArray values');
  }

  private sendEvent(event: XAIClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state !== 'open') {
      if (this.closedByUser) {
        this.emit('error', { message: 'Cannot send event after close()' });
        return;
      }
      this.queue.push(event);
      return;
    }

    try {
      this.ws.send(JSON.stringify(this.stripUndefined(event)));
    } catch (err) {
      this.emitError(err);
    }
  }

  private flushQueue(): void {
    const queuedEvents = this.queue.splice(0, this.queue.length);
    for (const event of queuedEvents) {
      this.sendEvent(event);
    }
  }

  private waitForOpen(ws: WSType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('WebSocket closed before opening'));
      };

      const cleanup = () => {
        ws.off?.('open', onOpen);
        ws.off?.('error', onError);
        ws.off?.('close', onClose);
      };

      ws.on('open', onOpen);
      ws.on('error', onError);
      ws.on('close', onClose);
    });
  }

  private getResponseId(event: XAIServerEvent): string {
    return (
      event.response_id ||
      event.response?.id ||
      event.item_id ||
      `fallback:${this.sessionGeneration}:${++this.fallbackResponseCounter}`
    );
  }

  private createSpeakerStream(responseId: string): StreamWithId {
    const existing = this.speakerStreams.get(responseId);
    if (existing) {
      return existing;
    }

    const stream = new PassThrough() as StreamWithId;
    stream.id = responseId;
    this.speakerStreams.set(responseId, stream);
    this.emit('speaker', stream);
    return stream;
  }

  private closeSpeakerStreams(): void {
    for (const stream of this.speakerStreams.values()) {
      stream.end();
    }
    this.speakerStreams.clear();
  }

  private endSpeakerStream(responseId: string): void {
    this.speakerStreams.get(responseId)?.end();
    this.speakerStreams.delete(responseId);
  }

  private cleanupSessionState(): void {
    this.sessionGeneration += 1;
    this.queue.length = 0;
    for (const cleanup of [...this.audioStreamCleanups]) {
      cleanup();
    }
    this.audioStreamCleanups.clear();
    for (const state of this.functionResponses.values()) {
      this.clearMissingFunctionCallTimeout(state);
    }
    this.functionResponses.clear();
    this.requestContext = undefined;
    this.closeSpeakerStreams();
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      callback(...args);
    }
  }

  private emitError(err: unknown): void {
    this.emit('error', {
      message: err instanceof Error ? err.message : String(err),
      details: err,
    });
  }

  private stripUndefined<T>(value: T, seen = new WeakSet<object>(), depth = 0, maxDepth = 100): T {
    if (!value || typeof value !== 'object') {
      return value;
    }

    if (depth >= maxDepth) {
      throw new Error('Cannot serialize xAI realtime event: maximum object depth exceeded');
    }

    const objectValue = value as object;
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      return value;
    }

    if (seen.has(objectValue)) {
      return undefined as T;
    }

    seen.add(objectValue);

    if (Array.isArray(value)) {
      const result = value
        .map(item => this.stripUndefined(item, seen, depth + 1, maxDepth))
        .filter(item => item !== undefined) as T;
      seen.delete(objectValue);
      return result;
    }

    const result = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, this.stripUndefined(entry, seen, depth + 1, maxDepth)])
        .filter(([, entry]) => entry !== undefined),
    ) as T;

    seen.delete(objectValue);
    return result;
  }

  private async readInputStream(input: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks);
  }
}
