import { PassThrough } from 'node:stream';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { MastraVoice } from '@mastra/core/voice';
import type { VoiceConfig, VoiceEventMap, VoiceEventType } from '@mastra/core/voice';
import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from '@aws-sdk/client-bedrock-runtime';

import type {
  NovaSonicVoiceConfig,
  NovaSonicVoiceId,
  NovaSonicAudioConfig,
  NovaSonicEventMap,
  NovaSonicInputEvent,
  NovaSonicOutputEvent,
  StreamWithId,
  EventCallback,
  SessionStartEvent,
  PromptStartEvent,
  ContentBlockStartEvent,
  TextInputEvent,
  AudioInputEvent,
  ContentBlockStopEvent,
  ToolResultEvent,
  PromptEndEvent,
  SessionEndEvent,
  OutputContentBlockStart,
  OutputAudioContent,
  OutputTextContent,
  OutputToolUse,
  OutputContentBlockStop,
  OutputTurnEnd,
  OutputError,
} from './types.js';

import { DEFAULT_MODEL, DEFAULT_VOICE, DEFAULT_REGION, DEFAULT_AUDIO_CONFIG, VOICES } from './types.js';

// Re-export public types
export type { NovaSonicVoiceConfig, NovaSonicVoiceId, NovaSonicAudioConfig } from './types.js';

/**
 * NovaSonicVoice provides real-time voice interaction capabilities using Amazon's
 * Nova Sonic speech-to-speech model via AWS Bedrock.
 *
 * Features:
 * - Real-time bidirectional audio streaming
 * - Text-to-speech and speech-to-text
 * - Voice activity detection
 * - Multiple voice options
 * - Tool calling during conversations
 * - Event-based audio streaming
 *
 * @extends MastraVoice
 *
 * @example
 * ```typescript
 * const voice = new NovaSonicVoice({
 *   region: 'us-east-1',
 *   speaker: 'tiffany',
 *   instructions: 'You are a helpful assistant.',
 * });
 *
 * await voice.connect();
 *
 * voice.on('speaking', ({ audio }) => {
 *   // Handle audio data
 * });
 *
 * voice.on('writing', ({ text, role }) => {
 *   console.log(`${role}: ${text}`);
 * });
 *
 * await voice.speak('Hello, how can I help you today?');
 * ```
 */
export class NovaSonicVoice extends MastraVoice<
  NovaSonicVoiceConfig,
  { speaker?: NovaSonicVoiceId },
  Record<string, unknown>,
  ToolsInput,
  VoiceEventMap
> {
  private state: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private events: NovaSonicEventMap = {} as NovaSonicEventMap;
  private instructions?: string;
  private tools?: ToolsInput;
  private debug: boolean;
  private options: NovaSonicVoiceConfig;
  private audioConfig: NovaSonicAudioConfig;
  private bedrockClient?: BedrockRuntimeClient;
  private inputQueue: NovaSonicInputEvent[] = [];
  private outputStream?: AsyncIterable<{ chunk?: { bytes?: Uint8Array } }>;
  private promptName: string = 'default-prompt';
  private contentBlockIndex: number = 0;
  private sessionActive: boolean = false;
  private speakerStreams: Map<string, StreamWithId> = new Map();
  private currentResponseId?: string;
  private requestContext?: RequestContext;
  private abortController?: AbortController;

  /**
   * Creates a new instance of NovaSonicVoice.
   *
   * @param config - Configuration options for the voice instance
   */
  constructor(config: VoiceConfig<NovaSonicVoiceConfig> | NovaSonicVoiceConfig = {}) {
    const normalizedConfig = NovaSonicVoice.normalizeConfig(config);
    super(normalizedConfig);

    this.options = normalizedConfig.realtimeConfig?.options || {};
    this.debug = this.options.debug || false;
    this.speaker = this.options.speaker || DEFAULT_VOICE;
    this.instructions = this.options.instructions;
    this.audioConfig = { ...DEFAULT_AUDIO_CONFIG, ...this.options.audioConfig };
  }

  /**
   * Normalize configuration to ensure proper VoiceConfig format
   */
  private static normalizeConfig(
    config: VoiceConfig<NovaSonicVoiceConfig> | NovaSonicVoiceConfig,
  ): VoiceConfig<NovaSonicVoiceConfig> {
    if ('realtimeConfig' in config || 'speechModel' in config || 'listeningModel' in config) {
      return config as VoiceConfig<NovaSonicVoiceConfig>;
    }

    const novaSonicConfig = config as NovaSonicVoiceConfig;
    return {
      speechModel: {
        name: novaSonicConfig.model || DEFAULT_MODEL,
        apiKey: novaSonicConfig.accessKeyId,
      },
      speaker: novaSonicConfig.speaker || DEFAULT_VOICE,
      realtimeConfig: {
        model: novaSonicConfig.model || DEFAULT_MODEL,
        apiKey: novaSonicConfig.accessKeyId,
        options: novaSonicConfig,
      },
    };
  }

  /** Returns a list of available voice speakers. */
  getSpeakers(): Promise<Array<{ voiceId: string; description?: string }>> {
    return Promise.resolve(VOICES.map(v => ({ voiceId: v.voiceId, description: v.description })));
  }

  /** Checks if listening capabilities are enabled. */
  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }

  /** Disconnects from the session and cleans up resources. */
  close(): void {
    this.disconnect();
  }

  /** Equips the voice instance with instructions. */
  addInstructions(instructions?: string): void {
    this.instructions = instructions;
  }

  /** Equips the voice instance with tools. */
  addTools(tools?: ToolsInput): void {
    this.tools = tools || {};
  }

  /** Establishes a connection to the Amazon Nova Sonic service. */
  async connect(options?: { requestContext?: RequestContext }): Promise<void> {
    if (this.state === 'connected') {
      this.log('Already connected to Nova Sonic');
      return;
    }

    this.requestContext = options?.requestContext;
    this.state = 'connecting';
    this.emit('session', { state: 'connecting' });

    try {
      this.bedrockClient = new BedrockRuntimeClient({
        region: this.options.region || DEFAULT_REGION,
        credentials:
          this.options.accessKeyId && this.options.secretAccessKey
            ? {
                accessKeyId: this.options.accessKeyId,
                secretAccessKey: this.options.secretAccessKey,
                sessionToken: this.options.sessionToken,
              }
            : undefined,
      });

      await this.initializeStream();

      this.state = 'connected';
      this.sessionActive = true;
      this.emit('session', { state: 'connected' });
      this.log('Connected to Nova Sonic');
    } catch (error) {
      this.state = 'disconnected';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Connection failed:', errorMessage);
      this.emit('error', { message: `Connection failed: ${errorMessage}`, code: 'connection_error', details: error });
      throw error;
    }
  }

  /** Initialize the bidirectional stream with Nova Sonic */
  private async initializeStream(): Promise<void> {
    if (!this.bedrockClient) {
      throw new Error('Bedrock client not initialized');
    }

    this.abortController = new AbortController();
    this.promptName = `prompt-${Date.now()}`;
    this.contentBlockIndex = 0;

    const inputGenerator = this.createInputGenerator();

    try {
      const command = new InvokeModelWithBidirectionalStreamCommand({
        modelId: this.options.model || DEFAULT_MODEL,
        body: inputGenerator,
      });

      const response = await this.bedrockClient.send(command, {
        abortSignal: this.abortController.signal,
      });

      if (response.body) {
        this.outputStream = response.body as AsyncIterable<{ chunk?: { bytes?: Uint8Array } }>;
        void this.processOutputStream();
      }

      await this.sendSessionStart();
      await this.sendPromptStart();

      if (this.instructions) {
        await this.sendSystemPrompt(this.instructions);
      }
    } catch (error) {
      this.log('Stream initialization error:', error);
      throw error;
    }
  }

  /** Create async generator for input events */
  private async *createInputGenerator(): AsyncGenerator<{ chunk: { bytes: Uint8Array } }> {
    while (this.isStreamActive()) {
      while (this.inputQueue.length > 0) {
        const event = this.inputQueue.shift()!;
        const bytes = new TextEncoder().encode(JSON.stringify(event));
        yield { chunk: { bytes } };
        this.log('Sent event:', event);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      if (!this.isStreamActive()) {
        break;
      }
    }
  }

  /** Check if the stream should remain active */
  private isStreamActive(): boolean {
    return this.state !== 'disconnected';
  }

  /** Process output stream from Nova Sonic */
  private async processOutputStream(): Promise<void> {
    if (!this.outputStream) return;

    try {
      for await (const chunk of this.outputStream) {
        if (this.state === 'disconnected') break;

        if (chunk.chunk?.bytes) {
          const text = new TextDecoder().decode(chunk.chunk.bytes);
          try {
            const event = JSON.parse(text) as NovaSonicOutputEvent;
            await this.handleOutputEvent(event);
          } catch (parseError) {
            this.log('Failed to parse output event:', parseError);
          }
        }
      }
    } catch (error) {
      if (this.state !== 'disconnected') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.log('Output stream error:', errorMessage);
        this.emit('error', { message: `Stream error: ${errorMessage}`, code: 'stream_error', details: error });
      }
    }
  }

  /** Handle output events from Nova Sonic */
  private async handleOutputEvent(event: NovaSonicOutputEvent): Promise<void> {
    this.log('Received event:', event);

    if ('contentBlockStart' in event) {
      this.handleContentBlockStart(event as OutputContentBlockStart);
    } else if ('audioOutput' in event) {
      this.handleAudioOutput(event as OutputAudioContent);
    } else if ('textOutput' in event) {
      this.handleTextOutput(event as OutputTextContent);
    } else if ('toolUse' in event) {
      await this.handleToolUse(event as OutputToolUse);
    } else if ('contentBlockStop' in event) {
      this.handleContentBlockStop(event as OutputContentBlockStop);
    } else if ('turnEnd' in event) {
      this.handleTurnEnd(event as OutputTurnEnd);
    } else if ('error' in event) {
      this.handleErrorEvent(event as OutputError);
    }
  }

  private handleContentBlockStart(data: OutputContentBlockStart): void {
    this.currentResponseId = `response-${Date.now()}-${data.contentBlockStart.contentBlockIndex}`;

    if (data.contentBlockStart.contentBlockType === 'audio') {
      const speakerStream = new PassThrough() as StreamWithId;
      speakerStream.id = this.currentResponseId;
      this.speakerStreams.set(this.currentResponseId, speakerStream);
      this.emit('speaker', speakerStream);
    }
  }

  private handleAudioOutput(data: OutputAudioContent): void {
    const responseId = this.currentResponseId || `response-${Date.now()}`;
    const audioBuffer = Buffer.from(data.audioOutput.audio, 'base64');
    const int16Array = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 2);

    const speakerStream = this.speakerStreams.get(responseId);
    if (speakerStream) {
      speakerStream.write(audioBuffer);
    }

    this.emit('speaking', {
      audio: data.audioOutput.audio,
      audioData: int16Array,
      sampleRate: this.audioConfig.outputSampleRate,
    });
  }

  private handleTextOutput(data: OutputTextContent): void {
    this.emit('writing', { text: data.textOutput.text, role: 'assistant' });
  }

  private async handleToolUse(data: OutputToolUse): Promise<void> {
    const toolName = data.toolUse.toolName;
    let toolArgs: Record<string, unknown>;

    try {
      toolArgs = JSON.parse(data.toolUse.input);
    } catch {
      toolArgs = {};
    }

    this.emit('toolCall', { name: toolName, args: toolArgs, id: data.toolUse.toolUseId });

    const tool = this.tools?.[toolName];
    if (!tool) {
      this.log(`Tool "${toolName}" not found`);
      await this.sendToolResult(data.toolUse.toolUseId, JSON.stringify({ error: `Tool "${toolName}" not found` }));
      return;
    }

    try {
      this.emit('tool-call-start', { toolCallId: data.toolUse.toolUseId, toolName, args: toolArgs });

      const result = await tool.execute?.(
        { context: toolArgs, requestContext: this.requestContext },
        { toolCallId: data.toolUse.toolUseId, messages: [] },
      );

      this.emit('tool-call-result', { toolCallId: data.toolUse.toolUseId, toolName, result });
      await this.sendToolResult(data.toolUse.toolUseId, JSON.stringify(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Tool "${toolName}" execution failed:`, errorMessage);
      await this.sendToolResult(data.toolUse.toolUseId, JSON.stringify({ error: errorMessage }));
    }
  }

  private handleContentBlockStop(_data: OutputContentBlockStop): void {
    const responseId = this.currentResponseId;
    if (responseId) {
      const speakerStream = this.speakerStreams.get(responseId);
      if (speakerStream) {
        speakerStream.end();
        this.speakerStreams.delete(responseId);
      }
    }
  }

  private handleTurnEnd(data: OutputTurnEnd): void {
    this.log('Turn ended:', data.turnEnd.stopReason);

    for (const [, stream] of this.speakerStreams) {
      stream.end();
    }
    this.speakerStreams.clear();

    this.emit('turnComplete', { timestamp: Date.now() });
  }

  private handleErrorEvent(data: OutputError): void {
    this.emit('error', { message: data.error.message, code: data.error.code || 'nova_sonic_error' });
  }

  private async sendSessionStart(): Promise<void> {
    const event: SessionStartEvent = {
      event: {
        sessionStart: {
          inferenceConfiguration: { maxTokens: 4096, topP: 0.9, temperature: 0.7 },
        },
      },
    };
    this.inputQueue.push(event);
  }

  private async sendPromptStart(): Promise<void> {
    const event: PromptStartEvent = {
      event: {
        promptStart: {
          promptName: this.promptName,
          textOutputConfiguration: { mediaType: 'text/plain' },
          audioOutputConfiguration: {
            mediaType: `audio/pcm;rate=${this.audioConfig.outputSampleRate}`,
            sampleRateHertz: this.audioConfig.outputSampleRate || 24000,
            voiceId: this.speaker || DEFAULT_VOICE,
          },
        },
      },
    };
    this.inputQueue.push(event);
  }

  private async sendSystemPrompt(instructions: string): Promise<void> {
    const startEvent: ContentBlockStartEvent = {
      event: {
        contentBlockStart: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          contentBlockType: 'system',
        },
      },
    };
    this.inputQueue.push(startEvent);

    const textEvent: TextInputEvent = {
      event: {
        textInput: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          text: instructions,
        },
      },
    };
    this.inputQueue.push(textEvent);

    const stopEvent: ContentBlockStopEvent = {
      event: {
        contentBlockStop: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
        },
      },
    };
    this.inputQueue.push(stopEvent);

    this.contentBlockIndex++;
  }

  private async sendToolResult(toolUseId: string, result: string): Promise<void> {
    const event: ToolResultEvent = {
      event: {
        toolResult: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          toolUseId,
          result,
        },
      },
    };
    this.inputQueue.push(event);
    this.contentBlockIndex++;
  }

  /** Disconnects from the Amazon Nova Sonic service. */
  disconnect(): void {
    if (this.state === 'disconnected') return;

    this.emit('session', { state: 'disconnecting' });

    if (this.sessionActive) {
      const endEvent: SessionEndEvent = { event: { sessionEnd: {} } };
      this.inputQueue.push(endEvent);
      this.sessionActive = false;
    }

    this.abortController?.abort();

    for (const [, stream] of this.speakerStreams) {
      stream.end();
    }
    this.speakerStreams.clear();

    this.state = 'disconnected';
    this.bedrockClient = undefined;
    this.outputStream = undefined;

    this.emit('session', { state: 'disconnected' });
    this.log('Disconnected from Nova Sonic');
  }

  /** Emits a speaking event using the configured voice model. */
  async speak(input: string | NodeJS.ReadableStream, options?: { speaker?: NovaSonicVoiceId }): Promise<void> {
    this.validateConnectionState();

    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }

    if (input.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const startEvent: ContentBlockStartEvent = {
      event: {
        contentBlockStart: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          contentBlockType: 'user',
        },
      },
    };
    this.inputQueue.push(startEvent);

    const textEvent: TextInputEvent = {
      event: {
        textInput: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          text: input,
        },
      },
    };
    this.inputQueue.push(textEvent);

    const stopEvent: ContentBlockStopEvent = {
      event: {
        contentBlockStop: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
        },
      },
    };
    this.inputQueue.push(stopEvent);

    this.contentBlockIndex++;
    this.log('Sent text for speech:', input);
  }

  /** Processes audio input for speech recognition. */
  async listen(audioData: NodeJS.ReadableStream): Promise<string> {
    this.validateConnectionState();

    return new Promise(async (resolve, reject) => {
      let transcription = '';

      const onWriting = (data: { text: string; role: 'assistant' | 'user' }) => {
        if (data.role === 'user') {
          transcription += data.text;
        }
      };

      const onTurnComplete = () => {
        cleanup();
        resolve(transcription.trim());
      };

      const onError = (error: { message: string }) => {
        cleanup();
        reject(new Error(error.message));
      };

      const cleanup = () => {
        this.off('writing', onWriting);
        this.off('turnComplete', onTurnComplete as EventCallback);
        this.off('error', onError);
      };

      this.on('writing', onWriting);
      this.on('turnComplete', onTurnComplete as EventCallback);
      this.on('error', onError);

      try {
        await this.send(audioData);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /** Streams audio data in real-time to the Amazon Nova Sonic service. */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    this.validateConnectionState();

    const startEvent: ContentBlockStartEvent = {
      event: {
        contentBlockStart: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
          contentBlockType: 'user',
        },
      },
    };
    this.inputQueue.push(startEvent);

    if (audioData instanceof Int16Array) {
      const buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
      const base64Audio = buffer.toString('base64');

      const audioEvent: AudioInputEvent = {
        event: {
          audioInput: {
            promptName: this.promptName,
            contentBlockIndex: this.contentBlockIndex,
            audio: base64Audio,
          },
        },
      };
      this.inputQueue.push(audioEvent);
    } else {
      const stream = audioData as NodeJS.ReadableStream;

      stream.on('data', (chunk: Buffer) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const base64Audio = buffer.toString('base64');

        const audioEvent: AudioInputEvent = {
          event: {
            audioInput: {
              promptName: this.promptName,
              contentBlockIndex: this.contentBlockIndex,
              audio: base64Audio,
            },
          },
        };
        this.inputQueue.push(audioEvent);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    }

    const stopEvent: ContentBlockStopEvent = {
      event: {
        contentBlockStop: {
          promptName: this.promptName,
          contentBlockIndex: this.contentBlockIndex,
        },
      },
    };
    this.inputQueue.push(stopEvent);

    this.contentBlockIndex++;
  }

  /** Triggers the voice provider to respond. */
  async answer(options?: Record<string, unknown>): Promise<void> {
    this.validateConnectionState();

    const event: PromptEndEvent = {
      event: {
        promptEnd: { promptName: this.promptName },
      },
    };
    this.inputQueue.push(event);

    this.promptName = `prompt-${Date.now()}`;
    this.contentBlockIndex = 0;
    await this.sendPromptStart();
  }

  /** Updates the session configuration. */
  updateConfig(sessionConfig: Record<string, unknown>): void {
    if (sessionConfig.speaker) {
      this.speaker = sessionConfig.speaker as NovaSonicVoiceId;
    }
    if (sessionConfig.instructions) {
      this.instructions = sessionConfig.instructions as string;
    }
    this.log('Config updated:', sessionConfig);
  }

  /** Registers an event listener. */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    (this.events[event] as EventCallback[]).push(callback as EventCallback);
  }

  /** Removes a previously registered event listener. */
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    if (!this.events[event]) return;

    const eventCallbacks = this.events[event] as EventCallback[];
    const index = eventCallbacks.indexOf(callback as EventCallback);
    if (index !== -1) {
      eventCallbacks.splice(index, 1);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    if (!this.events[event]) return;

    for (const callback of this.events[event] as EventCallback[]) {
      try {
        callback(...args);
      } catch (error) {
        this.log(`Error in event handler for "${event}":`, error);
      }
    }
  }

  private validateConnectionState(): void {
    if (this.state !== 'connected') {
      throw new Error('Not connected to Nova Sonic. Call connect() first.');
    }
  }

  /** Get current connection state */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' {
    return this.state;
  }

  /** Check if currently connected */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.info(`[NovaSonicVoice] ${message}`, ...args);
    }
  }
}
