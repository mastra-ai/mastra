import { MastraVoice } from '@internal/voice';
import type { ToolsInput, VoiceEventType, VoiceConfig } from '@internal/voice';
import { GoogleSchemaCompatLayer } from '@mastra/schema-compat';
import type { WebSocket as WSType } from 'ws';
import { WebSocket } from 'ws';
import { AudioStreamManager, ConnectionManager, ContextManager, AuthManager, EventManager } from './managers';
import { GeminiLiveErrorCode } from './types';
import type {
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiLiveEventMap,
  GeminiVoiceModel,
  GeminiVoiceName,
  GeminiToolConfig,
  AudioConfig,
  GeminiLiveServerMessage,
  GeminiSessionConfig,
  IncrementalTurn,
  UpdateMessage,
} from './types';
import { GeminiLiveError } from './utils/errors';

// Narrow event keys to strings for the typed EventManager
type GeminiEventName = Extract<keyof GeminiLiveEventMap, string>;

/**
 * Default configuration values
 */
const DEFAULT_MODEL: GeminiVoiceModel = 'gemini-3.1-flash-live-preview';
const DEFAULT_VOICE: GeminiVoiceName = 'Puck';

// Treats only plain objects (own prototype chain ends at `Object.prototype` or `null`) as
// proto-struct compatible — `Date`, `Map`, `Set`, `Error`, `RegExp`, and class instances all
// JSON-serialize to `{}` if forwarded bare and need wrapping for Gemini Live's `response` field.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Helper class for consistent error handling
 */
// GeminiLiveError is now defined in types.ts for reuse across managers

/**
 * GeminiLiveVoice provides real-time multimodal voice interactions using Google's Gemini Live API.
 *
 * Features:
 * - Bidirectional audio streaming
 * - Built-in VAD and interrupt handling
 * - Tool calling capabilities
 * - Session management and resumption
 * - Live transcription
 * - Support for both Gemini API and Vertex AI
 *
 * @example Backward compatibility - Direct options (legacy)
 * ```typescript
 * const voice = new GeminiLiveVoice({
 *   apiKey: 'your-api-key',
 *   model: 'gemini-2.0-flash-live-001',
 *   speaker: 'Puck',
 *   instructions: 'You are a helpful assistant'
 * });
 * ```
 *
 * @example Mastra VoiceConfig pattern - Recommended
 * ```typescript
 * const voice = new GeminiLiveVoice({
 *   speechModel: { name: 'gemini-2.0-flash-live-001', apiKey: 'your-api-key' },
 *   speaker: 'Puck',
 *   realtimeConfig: {
 *     model: 'gemini-2.0-flash-live-001',
 *     apiKey: 'your-api-key',
 *     options: {
 *       instructions: 'You are a helpful assistant',
 *       debug: true
 *     }
 *   }
 * });
 * ```
 *
 * @example Using Vertex AI (with OAuth)
 * ```typescript
 * const voice = new GeminiLiveVoice({
 *   realtimeConfig: {
 *     model: 'gemini-2.0-flash-live-001',
 *     options: {
 *       vertexAI: true,
 *       project: 'your-gcp-project',
 *       location: 'us-central1',
 *       serviceAccountKeyFile: '/path/to/service-account.json',
 *     }
 *   }
 * });
 * ```
 */
export class GeminiLiveVoice extends MastraVoice<
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiLiveVoiceOptions,
  ToolsInput,
  GeminiLiveEventMap
> {
  private ws?: WSType;
  private eventManager: EventManager;
  private state: 'disconnected' | 'connected' = 'disconnected';
  private sessionHandle?: string;
  private readonly debug: boolean;
  private readonly audioConfig: AudioConfig;
  private queue: unknown[] = [];

  // Managers
  private connectionManager: ConnectionManager;
  private contextManager: ContextManager;
  private authManager: AuthManager;

  // Audio chunk concatenation - optimized stream management
  private audioStreamManager: AudioStreamManager;

  // Session management properties
  private sessionId?: string;
  private sessionStartTime?: number;
  private isResuming = false;
  private sessionDurationTimeout?: NodeJS.Timeout;

  // Tool integration properties
  private tools?: ToolsInput;
  private requestContext?: any;

  // Store the configuration options
  private options: GeminiLiveVoiceConfig;

  // Accumulates assistant text across `serverContent` frames for the current
  // turn. Live API streams responses over many frames; we aggregate here and
  // flush to context history once on `turnComplete`.
  private pendingAssistantResponse = '';

  /**
   * Normalize configuration to ensure proper VoiceConfig format
   * Handles backward compatibility with direct GeminiLiveVoiceConfig
   * @private
   */
  private static normalizeConfig(
    config: VoiceConfig<GeminiLiveVoiceConfig> | GeminiLiveVoiceConfig,
  ): VoiceConfig<GeminiLiveVoiceConfig> {
    // Check if this is already a proper VoiceConfig (has realtimeConfig or standard VoiceConfig properties)
    if ('realtimeConfig' in config || 'speechModel' in config || 'listeningModel' in config) {
      return config as VoiceConfig<GeminiLiveVoiceConfig>;
    }

    // Convert direct GeminiLiveVoiceConfig to VoiceConfig format
    const geminiConfig = config as GeminiLiveVoiceConfig;
    return {
      speechModel: {
        name: geminiConfig.model || DEFAULT_MODEL,
        apiKey: geminiConfig.apiKey,
      },
      speaker: geminiConfig.speaker || DEFAULT_VOICE,
      realtimeConfig: {
        model: geminiConfig.model || DEFAULT_MODEL,
        apiKey: geminiConfig.apiKey,
        options: geminiConfig,
      },
    };
  }

  /**
   * Creates a new GeminiLiveVoice instance
   *
   * @param config Configuration options
   */
  constructor(config: VoiceConfig<GeminiLiveVoiceConfig> | GeminiLiveVoiceConfig = {}) {
    // Handle backward compatibility - if config has Gemini-specific properties directly,
    // convert to proper VoiceConfig format
    const normalizedConfig = GeminiLiveVoice.normalizeConfig(config);
    super(normalizedConfig);

    // Seed `this.options` from `realtimeConfig`. Fields on the `realtimeConfig` root
    // (`model`, `apiKey`, `vertexAI`, `project`, etc.) and on the inner `options` object both
    // belong in the flat `GeminiLiveVoiceConfig` shape this class reads from; merge with the
    // explicit inner `options` last so caller intent on the inner object wins on collisions.
    const realtimeConfig = normalizedConfig.realtimeConfig;
    if (realtimeConfig) {
      const { options: innerOptions, ...realtimeConfigRoot } = realtimeConfig;
      this.options = { ...(realtimeConfigRoot as Partial<GeminiLiveVoiceConfig>), ...(innerOptions || {}) };
    } else {
      this.options = {};
    }

    // `speaker` lives at the `VoiceConfig` root, sibling to `realtimeConfig` — not inside it.
    // Propagate explicitly so `new GeminiLiveVoice({ speaker: 'Puck', realtimeConfig: { ... } })`
    // honors the caller's voice. Reading from `normalizedConfig.speaker` would pin `DEFAULT_VOICE`
    // whenever the flat-config branch normalized without an explicit speaker, so use the raw `config`.
    if ('realtimeConfig' in config && config.speaker && !this.options.speaker) {
      this.options.speaker = config.speaker as GeminiVoiceName;
    }

    // Validate API key
    const apiKey = this.options.apiKey;
    if (!apiKey && !this.options.vertexAI) {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.API_KEY_MISSING,
        'Google API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey to constructor',
      );
    }

    this.debug = this.options.debug || false;

    // Merge provided audio config with defaults
    this.audioConfig = {
      ...AudioStreamManager.getDefaultAudioConfig(),
      ...this.options.audioConfig,
    };

    // Initialize AudioStreamManager
    this.audioStreamManager = new AudioStreamManager(this.audioConfig, this.debug);
    // Inject sender so AudioStreamManager can deliver realtime audio
    this.audioStreamManager.setSender((type, message) => this.sendEvent(type, message));

    this.eventManager = new EventManager<GeminiLiveEventMap>({ debug: this.debug });
    this.connectionManager = new ConnectionManager({ debug: this.debug, timeoutMs: 30000 });
    this.contextManager = new ContextManager({
      maxEntries: 100,
      compressionThreshold: 50,
      compressionEnabled: this.options.sessionConfig?.contextCompression ?? false,
    });
    this.authManager = new AuthManager({
      apiKey: this.options.apiKey,
      vertexAI: this.options.vertexAI,
      project: this.options.project,
      serviceAccountKeyFile: this.options.serviceAccountKeyFile,
      serviceAccountEmail: this.options.serviceAccountEmail,
      debug: this.debug,
      tokenExpirationTime: this.options.tokenExpirationTime,
    });

    if (this.options.vertexAI && !this.options.project) {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.PROJECT_ID_MISSING,
        'Google Cloud project ID is required when using Vertex AI. Set GOOGLE_CLOUD_PROJECT environment variable or pass project to constructor',
      );
    }

    // Auth initialization handled by AuthManager during connect
  }

  /**
   * Register an event listener
   * @param event Event name (e.g., 'speaking', 'writing', 'error', 'speaker')
   * @param callback Callback function that receives event data
   *
   * @example
   * ```typescript
   * // Listen for audio responses
   * voice.on('speaking', ({ audio, audioData, sampleRate }) => {
   *   console.log('Received audio chunk:', audioData.length);
   * });
   *
   * // Listen for text responses and transcriptions
   * voice.on('writing', ({ text, role }) => {
   *   console.log(`${role}: ${text}`);
   * });
   *
   * // Listen for audio streams (for concatenated playback)
   * voice.on('speaker', (audioStream) => {
   *   audioStream.pipe(playbackDevice);
   * });
   *
   * // Handle errors
   * voice.on('error', ({ message, code, details }) => {
   *   console.error('Voice error:', message);
   * });
   * ```
   */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void,
  ): void {
    try {
      this.eventManager.on(event as GeminiEventName, callback as any);
      this.log(`Event listener registered for: ${event}`);
    } catch (error) {
      this.log(`Failed to register event listener for ${event}:`, error);
      throw error;
    }
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Callback function to remove
   */
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void,
  ): void {
    try {
      this.eventManager.off(event as GeminiEventName, callback as any);
      this.log(`Event listener removed for: ${event}`);
    } catch (error) {
      this.log(`Failed to remove event listener for ${event}:`, error);
    }
  }

  /**
   * Register a one-time event listener that automatically removes itself after the first emission
   * @param event Event name
   * @param callback Callback function that receives event data
   */
  once<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void,
  ): void {
    try {
      this.eventManager.once(event as GeminiEventName, callback as any);
      this.log(`One-time event listener registered for: ${event}`);
    } catch (error) {
      this.log(`Failed to register one-time event listener for ${event}:`, error);
      throw error;
    }
  }

  /**
   * Emit an event to listeners with improved error handling
   * @private
   */
  private emit<K extends keyof GeminiLiveEventMap>(event: K, data: GeminiLiveEventMap[K]): boolean {
    try {
      const listenerCount = this.eventManager.getListenerCount(event as string);
      if (listenerCount === 0 && this.debug) {
        this.log(`No listeners for event: ${String(event)}`);
      }

      const result = this.eventManager.emit(event as GeminiEventName, data as any);

      if (this.debug && listenerCount > 0) {
        this.log(`Emitted event: ${String(event)} to ${listenerCount} listeners`);
      }

      return result;
    } catch (error) {
      this.log(`Error emitting event ${String(event)}:`, error);

      // Emit error event if this wasn't already an error event (prevent infinite loops)
      if (event !== 'error') {
        try {
          // Use underlying emitter directly to avoid recursion
          this.eventManager.getEventEmitter().emit('error', {
            message: `Failed to emit event: ${String(event)}`,
            code: 'event_emission_error',
            details: error,
          });
        } catch (nestedError) {
          // If we can't even emit the error event, log it
          this.log('Critical: Failed to emit error event:', nestedError);
        }
      }

      return false;
    }
  }

  /**
   * Clean up event listeners to prevent memory leaks
   * @private
   */
  private cleanupEventListeners(): void {
    try {
      // Get current listener counts for debugging
      const events = this.eventManager.getEventEmitter().eventNames();
      if (this.debug && events.length > 0) {
        this.log(
          'Cleaning up event listeners:',
          events.map(event => `${String(event)}: ${this.eventManager.getListenerCount(String(event))}`).join(', '),
        );
      }

      // Remove all listeners
      this.eventManager.cleanup();

      this.log('Event listeners cleaned up');
    } catch (error) {
      this.log('Error cleaning up event listeners:', error);
    }
  }

  /**
   * Get current event listener information for debugging
   * @returns Object with event names and listener counts
   */
  getEventListenerInfo(): Record<string, number> {
    try {
      return this.eventManager.getEventListenerInfo();
    } catch (error) {
      this.log('Error getting event listener info:', error);
      return {} as Record<string, number>;
    }
  }

  /**
   * Create and emit a standardized error
   * @private
   */
  private createAndEmitError(code: GeminiLiveErrorCode, message: string, details?: unknown): GeminiLiveError {
    const error = new GeminiLiveError(code, message, details);
    this.log(`Error [${code}]: ${message}`, details);
    this.emit('error', error.toEventData());
    return error;
  }

  /**
   * Handle connection state validation with standardized errors
   * @private
   */
  private validateConnectionState(): void {
    if (this.state !== 'connected') {
      throw this.createAndEmitError(
        GeminiLiveErrorCode.NOT_CONNECTED,
        'Not connected to Gemini Live API. Call connect() first.',
        { currentState: this.state },
      );
    }
  }

  /**
   * Handle WebSocket state validation with standardized errors
   * @private
   */
  private validateWebSocketState(): void {
    if (!this.connectionManager.isConnected()) {
      throw this.createAndEmitError(GeminiLiveErrorCode.WEBSOCKET_ERROR, 'WebSocket is not open', {
        wsExists: !!this.connectionManager.getWebSocket(),
        readyState: this.connectionManager.getWebSocket()?.readyState,
        expectedState: WebSocket.OPEN,
      });
    }
  }

  /**
   * Establish connection to the Gemini Live API
   */
  async connect({ requestContext }: { requestContext?: any } = {}): Promise<void> {
    if (this.state === 'connected') {
      this.log('Already connected to Gemini Live API');
      return;
    }

    // Store request context for tool execution
    this.requestContext = requestContext;

    // Emit connecting event
    this.emit('session', { state: 'connecting' });

    try {
      // Build WebSocket URL based on official Gemini Live API documentation
      let wsUrl: string;
      let headers: WebSocket.ClientOptions = {};

      if (this.options.vertexAI) {
        const location = this.getVertexLocation();
        // Vertex AI endpoint - using correct LlmBidiService endpoint
        wsUrl = `wss://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
        // Initialize auth and get token
        await this.authManager.initialize();
        const accessToken = await this.authManager.getAccessToken();
        headers = { headers: { Authorization: `Bearer ${accessToken}` } };
        this.log('Using Vertex AI authentication with OAuth token');
      } else {
        // Live API endpoint - this is specifically for the Live API
        wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
        headers = {
          headers: {
            'x-goog-api-key': this.options.apiKey || '',
            'Content-Type': 'application/json',
          },
        };
        this.log('Using Live API authentication with API key');
      }

      this.log('Connecting to:', wsUrl);
      this.ws = new WebSocket(wsUrl, undefined, headers);
      this.connectionManager.setWebSocket(this.ws);

      this.setupEventListeners();

      // Wait for WebSocket connection to open via ConnectionManager
      await this.connectionManager.waitForOpen();

      // Send initial configuration (session_resumption handle is embedded in setup frame)
      this.sendInitialConfig();
      this.sessionStartTime = Date.now();
      this.sessionId = crypto.randomUUID();

      // Wait for session to be created after sending config
      await this.waitForSessionCreated();

      this.state = 'connected';

      // Emit session connected event
      this.emit('session', {
        state: 'connected',
        config: {
          sessionId: this.sessionId,
          isResuming: this.isResuming,
          toolCount: Object.keys(this.tools || {}).length,
        },
      });

      this.log('Successfully connected to Gemini Live API', {
        sessionId: this.sessionId,
        isResuming: this.isResuming,
        toolCount: Object.keys(this.tools || {}).length,
      });

      // Start session duration monitoring if configured
      if (this.options.sessionConfig?.maxDuration) {
        this.startSessionDurationMonitor();
      }
    } catch (error) {
      this.state = 'disconnected';
      this.log('Connection failed', error);
      throw error;
    }
  }

  /**
   * Disconnect from the Gemini Live API
   */
  async disconnect(): Promise<void> {
    if (this.state === 'disconnected') {
      this.log('Already disconnected');
      return;
    }

    // Emit disconnecting event
    this.emit('session', { state: 'disconnecting' });

    // Clean up session duration monitoring
    if (this.sessionDurationTimeout) {
      clearTimeout(this.sessionDurationTimeout);
      this.sessionDurationTimeout = undefined;
    }

    // Session handle is set by the server via sessionResumptionUpdate frames.
    // Do not overwrite it with the client-side sessionId here.

    if (this.ws) {
      this.connectionManager.close();
      this.ws = undefined;
    }

    // Clean up speaker streams with improved handling
    this.audioStreamManager.cleanupSpeakerStreams();

    // Clear cached OAuth token via AuthManager
    this.authManager.clearCache();

    this.state = 'disconnected';
    this.isResuming = false;

    // Emit final session event before cleanup
    this.emit('session', { state: 'disconnected' });

    // Clean up event listeners to prevent memory leaks
    this.cleanupEventListeners();

    this.log('Disconnected from Gemini Live API', {
      sessionId: this.sessionId,
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : undefined,
    });
  }

  /**
   * Send text to be converted to speech
   */
  async speak(input: string | NodeJS.ReadableStream, options?: GeminiLiveVoiceOptions): Promise<void> {
    this.validateConnectionState();

    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }

    if (input.trim().length === 0) {
      throw this.createAndEmitError(GeminiLiveErrorCode.INVALID_AUDIO_FORMAT, 'Input text is empty');
    }

    // Add to context history
    this.addToContext('user', input);

    // Build text message to Gemini Live API
    const textMessage: any = {
      client_content: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: input,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    // If runtime options provided, send a session.update first to apply per-turn settings
    if (options && (options.speaker || options.languageCode || options.responseModalities)) {
      const updateMessage: UpdateMessage = {
        type: 'session.update',
        session: {
          generation_config: {
            ...(options.responseModalities ? { response_modalities: options.responseModalities } : {}),
            speech_config: {
              ...(options.languageCode ? { language_code: options.languageCode } : {}),
              ...(options.speaker ? { voice_config: { prebuilt_voice_config: { voice_name: options.speaker } } } : {}),
            },
          },
        },
      };

      try {
        this.sendEvent('session.update', updateMessage);
        this.log('Applied per-turn runtime options', options);
      } catch (error) {
        this.log('Failed to apply per-turn runtime options', error);
      }
    }

    try {
      this.sendEvent('client_content', textMessage);
      this.log('Text message sent', { text: input });

      // The response will come via the event system (handleServerContent)
      // Audio will be emitted through 'speaking' events
      // Text responses will be emitted through 'writing' events
    } catch (error) {
      this.log('Failed to send text message', error);
      throw this.createAndEmitError(GeminiLiveErrorCode.AUDIO_PROCESSING_ERROR, 'Failed to send text message', error);
    }
  }

  /**
   * Send conversation history into the live session without triggering a model response.
   *
   * Maps to a single Gemini Live `client_content` frame with `turnComplete` defaulting
   * to `false`, which loads the turns into context silently. The model only responds
   * once a subsequent turn completes (e.g. via {@link speak} or user audio).
   *
   * @param turns Prior conversation turns to seed into the session.
   * @param options.turnComplete Whether to mark the turn as complete (default `false`).
   *
   * @example
   * ```typescript
   * await voice.connect();
   *
   * // Replay prior conversation without triggering a reply.
   * await voice.sendContext([
   *   { role: 'user', content: 'What is the weather?' },
   *   { role: 'assistant', content: 'It is 72°F in San Francisco.' },
   * ]);
   *
   * // Agent stays silent until the user actually speaks.
   * await voice.send(micStream);
   * ```
   */
  async sendContext(turns: IncrementalTurn[], options?: { turnComplete?: boolean }): Promise<void> {
    this.validateConnectionState();

    if (!turns || turns.length === 0) {
      this.log('sendContext called with empty turns, skipping');
      return;
    }

    const message = {
      client_content: {
        turns: turns.map(t => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        turnComplete: options?.turnComplete ?? false,
      },
    };

    try {
      this.sendEvent('client_content', message);
      this.log('Context seeded', { turnCount: turns.length, turnComplete: options?.turnComplete ?? false });

      for (const turn of turns) {
        this.addToContext(turn.role, turn.content);
      }
    } catch (error) {
      this.log('Failed to send context', error);
      throw this.createAndEmitError(GeminiLiveErrorCode.AUDIO_PROCESSING_ERROR, 'Failed to send context', error);
    }
  }

  /**
   * Send audio stream for processing
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    this.validateConnectionState();

    if ('readable' in audioData && typeof audioData.on === 'function') {
      const stream = audioData as NodeJS.ReadableStream;

      stream.on('data', (chunk: Buffer) => {
        try {
          const base64Audio = this.audioStreamManager.processAudioChunk(chunk);
          const message = this.audioStreamManager.createAudioMessage(base64Audio, 'realtime');
          this.sendEvent('realtime_input', message);
        } catch (error) {
          this.log('Failed to process audio chunk', error);
          this.createAndEmitError(GeminiLiveErrorCode.AUDIO_PROCESSING_ERROR, 'Failed to process audio chunk', error);
        }
      });

      stream.on('error', (error: Error) => {
        this.log('Audio stream error', error);
        this.createAndEmitError(GeminiLiveErrorCode.AUDIO_STREAM_ERROR, 'Audio stream error', error);
      });

      stream.on('end', () => {
        this.log('Audio stream ended');
      });
    } else {
      const validateAudio = this.audioStreamManager.validateAndConvertAudioInput(audioData as Int16Array);
      const base64Audio = this.audioStreamManager.int16ArrayToBase64(validateAudio);
      const message = this.audioStreamManager.createAudioMessage(base64Audio, 'realtime');
      this.sendEvent('realtime_input', message);
    }
  }

  /**
   * Process speech from audio stream (traditional STT interface)
   */
  async listen(audioStream: NodeJS.ReadableStream, _options?: GeminiLiveVoiceOptions): Promise<string> {
    this.validateConnectionState();

    let transcriptionText = '';

    // Listen for transcription responses
    const onWriting = (data: { text: string; role: 'assistant' | 'user' }) => {
      if (data.role === 'user') {
        transcriptionText += data.text;
        this.log('Received transcription text:', { text: data.text, total: transcriptionText });
      }
      // Note: We only collect user role text as transcription
      // Assistant role text would be responses, not transcription
    };

    // Listen for errors
    const onError = (error: { message: string; code?: string; details?: unknown }) => {
      throw new Error(`Transcription failed: ${error.message}`);
    };

    // Listen for session events
    const onSession = (data: { state: string }) => {
      if (data.state === 'disconnected') {
        throw new Error('Session disconnected during transcription');
      }
    };

    // Set up GeminiLiveVoice event listeners
    this.on('writing', onWriting);
    this.on('error', onError);
    this.on('session', onSession);

    try {
      // Use AudioStreamManager to handle the transcription workflow
      const result = await this.audioStreamManager.handleAudioTranscription(
        audioStream,
        (base64Audio: string) => {
          // Send audio and await transcript until turn completes
          return new Promise<string>((resolve, reject) => {
            try {
              // Create audio message for transcription
              const message = this.audioStreamManager.createAudioMessage(base64Audio, 'input');

              const cleanup = () => {
                this.off('turnComplete' as any, onTurnComplete as any);
                this.off('error', onErr as any);
              };

              // Handlers
              const onTurnComplete = () => {
                cleanup();
                resolve(transcriptionText.trim());
              };

              const onErr = (e: { message: string }) => {
                cleanup();
                reject(new Error(e.message));
              };

              // Wire listeners before sending
              this.on('turnComplete' as any, onTurnComplete as any);
              this.on('error', onErr as any);

              // Send to Gemini Live API
              this.sendEvent('client_content', message);
              this.log('Sent audio for transcription');
            } catch (err) {
              reject(err as Error);
            }
          });
        },
        (error: Error) => {
          this.createAndEmitError(GeminiLiveErrorCode.AUDIO_PROCESSING_ERROR, 'Audio transcription failed', error);
        },
      );

      return result;
    } finally {
      // Clean up event listeners
      this.off('writing', onWriting);
      this.off('error', onError);
      this.off('session', onSession);
    }
  }

  /**
   * Get available speakers/voices
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; description?: string }>> {
    // Return available Gemini Live voices
    return [
      { voiceId: 'Puck', description: 'Conversational, friendly' },
      { voiceId: 'Charon', description: 'Deep, authoritative' },
      { voiceId: 'Kore', description: 'Neutral, professional' },
      { voiceId: 'Fenrir', description: 'Warm, approachable' },
    ];
  }

  /**
   * Resume a previous session using a session handle
   */
  async resumeSession(handle: string, context?: Array<{ role: string; content: string }>): Promise<void> {
    if (this.state === 'connected') {
      throw new Error('Cannot resume session while already connected. Disconnect first.');
    }

    this.log('Attempting to resume session', { handle });

    this.sessionHandle = handle;
    this.isResuming = true;

    // Restore context history if provided using ContextManager
    if (context && context.length > 0) {
      this.contextManager.clearContext();
      for (const item of context) {
        this.contextManager.addEntry(item.role as 'user' | 'assistant', item.content);
      }
    }

    try {
      await this.connect();
      this.log('Session resumed successfully', { handle, contextItems: context?.length || 0 });
    } catch (error) {
      this.isResuming = false;
      this.sessionHandle = undefined;
      throw new Error(`Failed to resume session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session configuration during an active session
   * Allows dynamic updates to voice, instructions, tools, and other settings
   *
   * @param config Partial configuration to update
   * @throws Error if not connected or update fails
   *
   * @example
   * ```typescript
   * // Change voice during conversation
   * await voice.updateSessionConfig({
   *   speaker: 'Charon'
   * });
   *
   * // Update instructions
   * await voice.updateSessionConfig({
   *   instructions: 'You are now a helpful coding assistant'
   * });
   *
   * // Add or update tools
   * await voice.updateSessionConfig({
   *   tools: [{ name: 'new_tool', ... }]
   * });
   * ```
   */
  async updateSessionConfig(config: Partial<GeminiLiveVoiceConfig>): Promise<void> {
    this.validateConnectionState();
    this.validateWebSocketState();

    return new Promise((resolve, reject) => {
      // Validate configuration
      if (config.model) {
        this.log('Warning: Model cannot be changed during an active session. Ignoring model update.');
      }

      if (config.vertexAI !== undefined || config.project !== undefined || config.location !== undefined) {
        this.log('Warning: Authentication settings cannot be changed during an active session.');
      }

      const updateMessage: UpdateMessage = {
        type: 'session.update',
        session: {},
      };

      let hasUpdates = false;

      // Update voice/speaker if provided
      if (config.speaker) {
        hasUpdates = true;
        updateMessage.session.generation_config = {
          ...updateMessage.session.generation_config,
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: config.speaker,
              },
            },
          },
        };

        // Update internal state
        this.speaker = config.speaker;
        this.log('Updating speaker to:', config.speaker);
      }

      // Update instructions if provided
      if (config.instructions !== undefined) {
        hasUpdates = true;
        updateMessage.session.system_instruction = {
          parts: [{ text: config.instructions }],
        };

        this.log('Updating instructions');
      }

      // Mirror `sendInitialConfig`: flatten both tool sources — the explicit `config.tools` arg
      // and the `addTools()` registry — into a single `function_declarations` container so the
      // model receives every available tool. The multi-container shape previously emitted here
      // was accepted by Gemini at setup but suppressed tool_call frames mid-session, reintroducing #17018.
      const hasRegisteredTools = !!this.tools && Object.keys(this.tools).length > 0;
      // `config.tools: []` is the explicit-clear signal; honor it even when the `addTools()`
      // registry is non-empty, otherwise the caller has no way to remove all tools mid-session.
      const isExplicitClear = Array.isArray(config.tools) && config.tools.length === 0;
      if (config.tools !== undefined || hasRegisteredTools) {
        hasUpdates = true;
        const declarations = isExplicitClear ? [] : this.buildToolDeclarations(config.tools, this.tools);
        if (declarations.length > 0) {
          updateMessage.session.tools = [{ function_declarations: declarations }];
        } else {
          updateMessage.session.tools = [];
        }
        this.log('Updating tools:', declarations.length, 'tools');
      }

      // Update session configuration if provided
      if (config.sessionConfig) {
        // Handle VAD settings
        if (config.sessionConfig.vad) {
          hasUpdates = true;
          updateMessage.session.vad = {
            enabled: config.sessionConfig.vad.enabled ?? true,
            sensitivity: config.sessionConfig.vad.sensitivity ?? 0.5,
            silence_duration_ms: config.sessionConfig.vad.silenceDurationMs ?? 1000,
          };
          this.log('Updating VAD settings:', config.sessionConfig.vad);
        }

        // Handle interrupt settings
        if (config.sessionConfig.interrupts) {
          hasUpdates = true;
          updateMessage.session.interrupts = {
            enabled: config.sessionConfig.interrupts.enabled ?? true,
            allow_user_interruption: config.sessionConfig.interrupts.allowUserInterruption ?? true,
          };
          this.log('Updating interrupt settings:', config.sessionConfig.interrupts);
        }

        // Handle context compression
        if (config.sessionConfig.contextCompression !== undefined) {
          hasUpdates = true;
          updateMessage.session.context_compression = config.sessionConfig.contextCompression;
          this.log('Updating context compression:', config.sessionConfig.contextCompression);
          // Apply to ContextManager
          this.contextManager.setCompressionEnabled(config.sessionConfig.contextCompression);
        }
      }

      // Check if there are any updates to send
      if (!hasUpdates) {
        this.log('No valid configuration updates to send');
        resolve();
        return;
      }

      // Set up timeout for response
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Session configuration update timeout - no response received'));
      }, 10000); // 10 second timeout

      // Listen for update confirmation
      const onSessionUpdated = (data: GeminiLiveServerMessage) => {
        cleanup();
        this.log('Session configuration updated successfully', data);
        resolve();
      };

      // Listen for errors
      const onError = (error: { message?: string; code?: string; details?: unknown }) => {
        cleanup();
        this.log('Session configuration update failed', error);
        reject(new Error(`Failed to update session configuration: ${error.message || 'Unknown error'}`));
      };

      // Set up event listeners
      const cleanup = () => {
        clearTimeout(timeout);
        this.eventManager.getEventEmitter().removeListener('session.updated', onSessionUpdated as any);
        this.eventManager.getEventEmitter().removeListener('error', onError as any);
      };

      this.eventManager.getEventEmitter().once('session.updated', onSessionUpdated as any);
      this.eventManager.getEventEmitter().once('error', onError as any);

      // Send the update message
      try {
        this.sendEvent('session.update', updateMessage);
        this.log('Sent session configuration update', updateMessage);
      } catch (error) {
        cleanup();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.log('Failed to send session configuration update', error);
        reject(new Error(`Failed to send session configuration update: ${errorMessage}`));
      }
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): 'disconnected' | 'connected' {
    return this.state;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get current speaker stream for audio concatenation
   * This allows external access to the current audio stream being built
   */
  getCurrentSpeakerStream(): NodeJS.ReadableStream | null {
    return this.audioStreamManager.getCurrentSpeakerStream();
  }

  /**
   * Get session handle for resumption
   */
  getSessionHandle(): string | undefined {
    // TODO: Return actual session handle when Gemini Live API supports session resumption
    return this.sessionHandle;
  }

  /**
   * Get comprehensive session information
   */
  getSessionInfo(): {
    id?: string;
    handle?: string;
    startTime?: Date;
    duration?: number;
    state: string;
    config?: GeminiSessionConfig;
    contextSize: number;
  } {
    return {
      id: this.sessionId,
      handle: this.sessionHandle,
      startTime: this.sessionStartTime ? new Date(this.sessionStartTime) : undefined,
      duration: this.sessionStartTime ? Date.now() - this.sessionStartTime : undefined,
      state: this.state,
      config: this.options.sessionConfig,
      contextSize: this.contextManager.getContextSize(),
    };
  }

  /**
   * Get session context history
   */
  getContextHistory(): Array<{ role: string; content: string; timestamp: number }> {
    return this.contextManager.getContextHistory();
  }

  /**
   * Add to context history for session continuity
   */
  addToContext(role: 'user' | 'assistant', content: string): void {
    this.contextManager.addEntry(role, content);
  }

  /**
   * Clear session context
   */
  clearContext(): void {
    this.contextManager.clearContext();
    this.log('Session context cleared');
  }

  /**
   * Enable or disable automatic reconnection
   */
  setAutoReconnect(enabled: boolean): void {
    if (!this.options.sessionConfig) {
      this.options.sessionConfig = {};
    }
    this.options.sessionConfig.enableResumption = enabled;
    this.log(`Auto-reconnect ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Send session resumption message
   * @private
   */
  /**
   * Start monitoring session duration
   * @private
   */
  private startSessionDurationMonitor(): void {
    if (!this.options.sessionConfig?.maxDuration) {
      return;
    }

    // Parse duration string (e.g., '24h', '2h', '30m')
    const durationMs = this.parseDuration(this.options.sessionConfig.maxDuration);

    if (!durationMs) {
      this.log('Invalid session duration format', { duration: this.options.sessionConfig.maxDuration });
      return;
    }

    // Clear existing monitor if any
    if (this.sessionDurationTimeout) {
      clearTimeout(this.sessionDurationTimeout);
    }

    // Set timeout for session expiry warning
    const warningTime = durationMs - 5 * 60 * 1000; // 5 minutes before expiry

    if (warningTime > 0) {
      setTimeout(() => {
        this.emit('sessionExpiring', {
          expiresIn: 5 * 60 * 1000,
          sessionId: this.sessionId,
        });
      }, warningTime);
    }

    // Set timeout for session expiry
    this.sessionDurationTimeout = setTimeout(() => {
      this.log('Session duration limit reached, disconnecting');
      void this.disconnect();
    }, durationMs);
  }

  /**
   * Parse duration string to milliseconds
   * @private
   */
  private parseDuration(duration: string): number | null {
    const match = duration.match(/^(\d+)([hms])$/);
    if (!match) return null;

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 's':
        return value * 1000;
      default:
        return null;
    }
  }

  /**
   * Compress context history to manage memory
   * @private
   */
  private compressContext(): void {
    // Deprecated: ContextManager handles compression
    this.log('compressContext is deprecated; handled by ContextManager');
  }

  /**
   * Setup WebSocket event listeners for Gemini Live API messages
   * @private
   */
  private setupEventListeners(): void {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    // Handle WebSocket connection events
    this.ws.on('open', () => {
      this.log('WebSocket connection opened');
      // Note: We transition to 'connected' in connect() after setup is complete
      // This is just confirming the WebSocket is open
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.log('WebSocket connection closed', { code, reason: reason.toString() });
      this.state = 'disconnected';
      this.emit('session', { state: 'disconnected', code, reason: reason.toString() });
    });

    this.ws.on('error', (error: Error) => {
      this.log('WebSocket error', error);
      this.state = 'disconnected';
      this.emit('session', { state: 'disconnected' });
      this.emit('error', {
        message: error.message,
        code: 'websocket_error',
        details: error,
      });
    });

    // Handle incoming messages from Gemini Live API
    this.ws.on('message', async (message: Buffer | string) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleGeminiMessage(data);
      } catch (error) {
        this.log('Failed to parse WebSocket message', error);
        this.emit('error', {
          message: 'Failed to parse WebSocket message',
          code: 'parse_error',
          details: error,
        });
      }
    });
  }

  /**
   * Handle different types of messages from Gemini Live API
   * @private
   */
  private async handleGeminiMessage(data: GeminiLiveServerMessage): Promise<void> {
    // Always log received messages in debug mode or when troubleshooting
    this.log('Received message:', JSON.stringify(data, null, 2));

    // Extract response ID if present in the message
    if ((data as any).responseId) {
      this.setCurrentResponseId((data as any).responseId);
      this.log('Set current response ID:', (data as any).responseId);
    }

    // Handle different Gemini Live API message structures
    if (data.setup) {
      this.log('Processing setup message');
      this.handleSetupComplete(data);
    } else if (data.setupComplete) {
      this.log('Processing setupComplete message');
      this.handleSetupComplete(data);
    } else if (data.serverContent) {
      this.log('Processing server content message');
      this.handleServerContent(data.serverContent);
    } else if (data.toolCall) {
      this.log('Processing tool call message');
      await this.handleToolCall(data);
    } else if (data.usageMetadata) {
      this.log('Processing usage metadata message');
      this.handleUsageUpdate(data);
      // sessionResumptionUpdate may arrive in the same frame as usageMetadata
      // so we handle it here too, not in a separate else-if branch
    }
    if (data.sessionResumptionUpdate) {
      this.log('Processing session resumption update', data.sessionResumptionUpdate);
      if (data.sessionResumptionUpdate.resumable && data.sessionResumptionUpdate.newHandle) {
        this.sessionHandle = data.sessionResumptionUpdate.newHandle;
        this.log('Session handle updated from server', { handle: this.sessionHandle });
        this.emit('sessionHandle', {
          handle: this.sessionHandle,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h TTL for AI Studio
        });
      }
    } else if (data.sessionEnd) {
      this.log('Processing session end message');
      this.handleSessionEnd(data);
    } else if (data.error) {
      this.log('Processing error message');
      this.handleError(data.error);
    } else {
      // Handle alternative message formats by checking for common fields
      const messageData = data as any; // Use any for flexible message handling

      // Check for various possible setup completion indicators
      if (messageData.type === 'setup' || messageData.type === 'session.ready' || messageData.type === 'ready') {
        // Handle alternative setup message formats
        this.log('Processing alternative setup message with type:', messageData.type);
        this.handleSetupComplete(data);
      } else if (messageData.sessionHandle) {
        // Handle session handle in response
        this.log('Processing session handle message');
        this.handleSetupComplete(data);
      } else if (
        messageData.session ||
        messageData.ready ||
        messageData.status === 'ready' ||
        messageData.status === 'setup_complete'
      ) {
        // Try to handle as setup completion if it has any setup-related fields
        this.log('Processing setup completion message with status:', messageData.status);
        this.handleSetupComplete(data);
      } else if (messageData.candidates || messageData.promptFeedback) {
        // Handle successful response from BidiGenerateContent
        this.log('Processing BidiGenerateContent response');
        this.handleSetupComplete(data);
      } else if (messageData.contents && Array.isArray(messageData.contents)) {
        // Handle content response
        this.log('Processing content response');
        this.handleServerContent({ modelTurn: { parts: messageData.contents.flatMap((c: any) => c.parts || []) } });
        // Also treat this as setup completion since we got a response
        this.handleSetupComplete(data);
      } else if (messageData.candidates && Array.isArray(messageData.candidates)) {
        // Handle candidates response (common in Gemini API)
        this.log('Processing candidates response');
        this.handleSetupComplete(data);
      } else {
        this.log('Unknown message format - no recognized fields found');
      }
    }
  }

  /**
   * Handle setup completion message
   * @private
   */
  private handleSetupComplete(data: GeminiLiveServerMessage): void {
    this.log('Setup completed');

    // Process all queued messages now that the session is ready
    const queue = this.queue.splice(0, this.queue.length);
    if (queue.length > 0) {
      this.log('Processing queued messages:', queue.length);
      for (const queuedMessage of queue) {
        try {
          this.connectionManager.send(JSON.stringify(queuedMessage));
          this.log('Sent queued message:', queuedMessage);
        } catch (err) {
          this.log('Failed to send queued message, re-queuing:', err);
          this.queue.unshift(queuedMessage);
          break;
        }
      }
    }

    // Emit event for waitForSessionCreated to resolve
    this.eventManager.getEventEmitter().emit('setupComplete', data as any);
    // Session is now ready for communication
  }

  /**
   * Handle session update confirmation
   * @private
   */
  private handleSessionUpdated(data: GeminiLiveServerMessage): void {
    this.log('Session updated', data);
    // Emit event for updateSessionConfig to resolve
    this.eventManager.getEventEmitter().emit('session.updated', data as any);

    // Also emit a general session event for any external listeners
    this.emit('session', {
      state: 'updated',
      config: data as Record<string, unknown>,
    });
  }

  /**
   * Handle server content (text/audio responses)
   * @private
   */
  private handleServerContent(data: GeminiLiveServerMessage['serverContent']): void {
    if (!data) {
      return;
    }

    // Barge-in: the server cancelled the in-flight model response because the
    // user started speaking. Surface this as the `interrupt` event so consumers
    // can drop queued TTS audio. Matches the `interrupt` shape emitted by
    // `@mastra/voice-aws-nova-sonic`.
    //
    // The cancelled turn will not necessarily be followed by `turnComplete`, so
    // end any in-flight speaker streams here. Otherwise stream counters never
    // decrement and downstream playback hangs on the cancelled audio. Discard
    // the partial assistant text — it does not represent a completed turn.
    if (data.interrupted) {
      this.log('Model response interrupted by user activity');
      this.audioStreamManager.cleanupSpeakerStreams();
      this.pendingAssistantResponse = '';
      this.emit('interrupt', { type: 'user', timestamp: Date.now() });
    }

    // User-side transcription. Emitted as `writing` with `role: 'user'`,
    // matching the OpenAI / xAI / Inworld realtime pattern of using a single
    // `writing` channel with role disambiguation.
    if (data.inputTranscription?.text) {
      this.emit('writing', {
        text: data.inputTranscription.text,
        role: 'user',
      });
    }

    // Model-side transcription. On native-audio models this is the
    // authoritative source for the spoken response — emit it as `writing` with
    // `role: 'assistant'`. On non-native-audio models this field is not sent
    // (the spoken response comes from `modelTurn.parts.text` below).
    if (data.outputTranscription?.text) {
      this.pendingAssistantResponse += data.outputTranscription.text;
      this.emit('writing', {
        text: data.outputTranscription.text,
        role: 'assistant',
      });
    }

    const nativeAudio = this.isNativeAudioModel();

    if (data.modelTurn?.parts) {
      for (const part of data.modelTurn.parts) {
        // Handle text content. Native-audio models put their internal reasoning
        // here while the spoken response goes through `outputTranscription`
        // above — route reasoning to the Gemini-specific `thinking` event so
        // consumers can render it separately without conflating it with the
        // assistant's actual reply. Non-native-audio models do not send
        // `outputTranscription`, so `part.text` IS the spoken response and
        // continues to flow through `writing`.
        if (part.text) {
          if (nativeAudio) {
            this.emit('thinking', { text: part.text });
          } else {
            this.pendingAssistantResponse += part.text;
            this.emit('writing', {
              text: part.text,
              role: 'assistant',
            });
          }
        }

        // Handle function calls (tool calls) embedded in parts
        // Gemini Live API sends tool calls inside serverContent.modelTurn.parts
        if (part.functionCall) {
          this.log('Found function call in serverContent.modelTurn.parts', part.functionCall);

          // Convert to toolCall format and handle
          const toolCallData: GeminiLiveServerMessage = {
            toolCall: {
              name: part.functionCall.name,
              args: part.functionCall.args || {},
              id: part.functionCall.id || crypto.randomUUID(),
            },
          };

          // Handle the tool call asynchronously
          void this.handleToolCall(toolCallData);

          // Continue to next part without processing audio/text
          continue;
        }

        // Handle audio content - implement chunk concatenation with proper response ID tracking
        if (part.inlineData?.mimeType?.includes('audio') && typeof part.inlineData.data === 'string') {
          try {
            const audioData = part.inlineData.data;
            const int16Array = this.audioStreamManager.base64ToInt16Array(audioData);

            // Use the tracked response ID or generate one if not available
            const responseId = this.getCurrentResponseId() || crypto.randomUUID();

            // Get or create the speaker stream for this response
            let speakerStream = this.audioStreamManager.getSpeakerStream(responseId);
            if (!speakerStream) {
              // Clean up stale streams and enforce limits before creating new ones
              this.audioStreamManager.cleanupStaleStreams();
              this.audioStreamManager.enforceStreamLimits();

              // Create new stream through the manager
              speakerStream = this.audioStreamManager.createSpeakerStream(responseId);

              // Add error handling to the stream
              speakerStream.on('error', (streamError: Error) => {
                this.log(`Speaker stream error for ${responseId}:`, streamError);
                this.audioStreamManager.removeSpeakerStream(responseId);
                this.emit('error', {
                  message: 'Speaker stream error',
                  code: 'speaker_stream_error',
                  details: { responseId, error: streamError },
                });
              });

              // Auto-cleanup when stream ends
              speakerStream.on('end', () => {
                this.log(`Speaker stream ended for response: ${responseId}`);
                this.audioStreamManager.removeSpeakerStream(responseId);
              });

              // Auto-cleanup when stream is destroyed
              speakerStream.on('close', () => {
                this.log(`Speaker stream closed for response: ${responseId}`);
                this.audioStreamManager.removeSpeakerStream(responseId);
              });

              this.log('Created new speaker stream for response:', responseId);

              // Emit the speaker stream for external listeners
              this.emit('speaker', speakerStream as NodeJS.ReadableStream);
            }

            // Write the audio chunk to the stream
            const audioBuffer = Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
            speakerStream.write(audioBuffer);

            this.log('Wrote audio chunk to stream:', {
              responseId,
              chunkSize: audioBuffer.length,
              totalStreams: this.audioStreamManager.getActiveStreamCount(),
            });

            // Also emit the individual speaking event for backward compatibility
            this.emit('speaking', {
              audio: audioData, // Base64 string
              audioData: int16Array,
              sampleRate: this.audioConfig.outputSampleRate, // Gemini Live outputs at 24kHz
            });
          } catch (error) {
            this.log('Error processing audio data:', error);
            this.emit('error', {
              message: 'Failed to process audio data',
              code: 'audio_processing_error',
              details: error,
            });
          }
        }
      }
    }

    // Check for turn completion
    if (data.turnComplete) {
      this.log('Turn completed');

      // Flush the assistant text accumulated across this turn's `serverContent`
      // frames as a single context entry. Doing this once per turn (rather than
      // once per frame) keeps the conversation history coherent even when the
      // Live API streams a response over many incremental frames.
      if (this.pendingAssistantResponse.trim()) {
        this.addToContext('assistant', this.pendingAssistantResponse);
      }
      this.pendingAssistantResponse = '';

      // End all active speaker streams for this turn
      this.audioStreamManager.cleanupSpeakerStreams();

      // Emit turn completion event
      this.emit('turnComplete', {
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle tool call requests from the model
   * @private
   */
  private async handleToolCall(data: GeminiLiveServerMessage): Promise<void> {
    if (!data.toolCall) {
      return;
    }

    // Handle both formats:
    // 1. Direct format: { toolCall: { name, args, id } }
    // 2. Array format: { toolCall: { functionCalls: [{ name, args, id }] } }
    let toolCalls: Array<{ name?: string; args?: Record<string, any>; id?: string }> = [];

    if (data.toolCall.functionCalls && Array.isArray(data.toolCall.functionCalls)) {
      // Array format (actual Gemini API format)
      toolCalls = data.toolCall.functionCalls;
    } else if (data.toolCall.name) {
      // Direct format (for backward compatibility)
      toolCalls = [{ name: data.toolCall.name, args: data.toolCall.args, id: data.toolCall.id }];
    }

    // Process each tool call
    for (const toolCall of toolCalls) {
      const toolName = toolCall.name || '';
      const toolArgs = toolCall.args || {};
      const toolId = toolCall.id || crypto.randomUUID();

      await this.processSingleToolCall(toolName, toolArgs, toolId);
    }
  }

  /**
   * Process a single tool call
   * @private
   */
  private async processSingleToolCall(toolName: string, toolArgs: Record<string, any>, toolId: string): Promise<void> {
    this.log('Processing tool call', { toolName, toolArgs, toolId });

    // Emit tool call event
    this.emit('toolCall', {
      name: toolName,
      args: toolArgs,
      id: toolId,
    });

    // Find the tool
    const tool = this.tools?.[toolName];
    if (!tool) {
      this.log('Tool not found', { toolName });
      this.createAndEmitError(GeminiLiveErrorCode.TOOL_NOT_FOUND, `Tool "${toolName}" not found`, {
        toolName,
        availableTools: Object.keys(this.tools || {}),
      });
      return;
    }

    try {
      // Execute the tool
      let result: unknown;

      if (tool.execute) {
        this.log('Executing tool', { toolName, toolArgs });

        // Execute with proper context
        result = await tool.execute(toolArgs, { requestContext: this.requestContext });

        this.log('Tool executed successfully', { toolName, result });
      } else {
        this.log('Tool has no execute function', { toolName });
        result = { error: 'Tool has no execute function' };
      }

      // Gemini Live's `response` proto field is a struct, not repeating. Tools returning arrays
      // or primitives close the session with `1007 Unknown name "response": Proto field is not
      // repeating`. Wrap everything except plain objects in `{ result }` so the field is always a
      // struct — `Date`, `Map`, `Set`, `Error`, and class instances all serialize as `{}` if sent
      // bare (their own enumerable properties are empty), losing the tool's data silently.
      const responsePayload = isPlainObject(result) ? result : { result };

      // Send tool result back to Gemini Live API
      const toolResultMessage = {
        toolResponse: {
          functionResponses: [
            {
              id: toolId,
              name: toolName,
              response: responsePayload,
            },
          ],
        },
      };

      this.sendEvent('toolResponse', toolResultMessage);
      this.log('Tool result sent', { toolName, toolId, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Tool execution failed', { toolName, error: errorMessage });

      // Send error result back to Gemini Live API
      const errorResultMessage = {
        toolResponse: {
          functionResponses: [
            {
              id: toolId,
              name: toolName,
              response: { error: errorMessage },
            },
          ],
        },
      };

      this.sendEvent('toolResponse', errorResultMessage);

      // Emit error event
      this.createAndEmitError(GeminiLiveErrorCode.TOOL_EXECUTION_ERROR, `Tool execution failed: ${errorMessage}`, {
        toolName,
        toolArgs,
        error,
      });
    }
  }

  /**
   * Handle token usage information
   * @private
   */
  private handleUsageUpdate(data: GeminiLiveServerMessage): void {
    if (data.usageMetadata) {
      this.emit('usage', {
        inputTokens: data.usageMetadata.promptTokenCount || 0,
        outputTokens: data.usageMetadata.responseTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
        modality: this.determineModality(data),
      });
    }
  }

  /**
   * Handle session end
   * @private
   */
  private handleSessionEnd(data: GeminiLiveServerMessage): void {
    this.log('Session ended', data.sessionEnd?.reason);
    this.state = 'disconnected';
    this.emit('session', { state: 'disconnected' });
  }

  /**
   * Handle errors
   * @private
   */
  private handleError(error: GeminiLiveServerMessage['error']): void {
    if (!error) {
      this.log('Received error from Gemini Live API (no error details)');
      return;
    }

    this.log('Received error from Gemini Live API', error);
    this.emit('error', {
      message: error.message || 'Unknown error',
      code: error.code || 'unknown_error',
      details: error.details,
    });
  }

  /**
   * Determine the modality from message data
   * @private
   */
  private determineModality(data: GeminiLiveServerMessage): 'audio' | 'text' | 'video' {
    // Simple heuristic - this could be more sophisticated
    if (data.serverContent?.modelTurn?.parts?.some(part => part.inlineData?.mimeType?.includes('audio'))) {
      return 'audio';
    }
    // Support for video is not yet implemented, leaving this here for future use if needed
    if (data.serverContent?.modelTurn?.parts?.some(part => part.inlineData?.mimeType?.includes('video'))) {
      return 'video';
    }
    return 'text';
  }

  /**
   * Resolve Vertex AI location with sensible default
   * @private
   */
  private getVertexLocation(): string {
    return this.options.location?.trim() || 'us-central1';
  }

  /**
   * Whether the active model is a Gemini Live "native-audio" variant.
   *
   * Native-audio models emit a different `serverContent.modelTurn.parts.text`
   * stream than their half-cascade siblings: on native-audio, that text is the
   * model's internal reasoning (chain-of-thought), and the *spoken* response
   * arrives separately via `serverContent.outputTranscription.text`. On
   * non-native-audio models there is no `outputTranscription` channel, and
   * `modelTurn.parts.text` is the spoken response.
   *
   * Used to decide whether `modelTurn.parts.text` should be emitted as
   * `thinking` (native-audio) or `writing` (non-native-audio). All native-audio
   * model IDs in `GeminiVoiceModel` contain the literal substring
   * `native-audio`, so a substring check is sufficient and forward-compatible
   * with new variants that follow the same naming convention.
   * @private
   */
  private isNativeAudioModel(): boolean {
    const model = this.options.model ?? DEFAULT_MODEL;
    return model.includes('native-audio');
  }

  /**
   * Resolve the correct model identifier for Gemini API or Vertex AI
   * @private
   */
  private resolveModelIdentifier(): string {
    const model = this.options.model ?? DEFAULT_MODEL;

    if (!this.options.vertexAI) {
      return `models/${model}`;
    }

    if (!this.options.project) {
      throw this.createAndEmitError(
        GeminiLiveErrorCode.PROJECT_ID_MISSING,
        'Google Cloud project ID is required when using Vertex AI.',
      );
    }

    const location = this.getVertexLocation();
    return `projects/${this.options.project}/locations/${location}/publishers/google/models/${model}`;
  }

  /**
   * Send initial configuration to Gemini Live API
   * @private
   */
  private sendInitialConfig(): void {
    if (!this.ws || !this.connectionManager.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    // Live API setup message. Keys must be snake_case to match Gemini Live's wire format —
    // camelCase keys cause native-audio models to reject the setup with
    // `1007 Cannot extract voices from a non-audio request`. Matches the `UpdateMessage` shape
    // already used by this package's `session.update` path.
    interface LiveGenerateContentSetup {
      model?: string;
      generation_config?: {
        temperature?: number;
        top_k?: number;
        top_p?: number;
        max_output_tokens?: number;
        stop_sequences?: string[];
        candidate_count?: number;
        response_modalities?: ('AUDIO' | 'TEXT')[];
        speech_config?: {
          voice_config?: {
            prebuilt_voice_config?: {
              voice_name?: string;
            };
          };
        };
      };
      system_instruction?: {
        parts: Array<{
          text: string;
        }>;
      };
      tools?: Array<{
        function_declarations: Array<{
          name: string;
          description?: string;
          parameters?: unknown;
        }>;
      }>;
      /**
       * Empty-object flag that enables server-side ASR for the user's spoken
       * input. When set, the server emits `serverContent.inputTranscription.text`
       * frames alongside audio. Required to surface what the user said.
       */
      input_audio_transcription?: Record<string, never>;
      /**
       * Empty-object flag that enables server-side transcription of the model's
       * spoken output. When set, the server emits
       * `serverContent.outputTranscription.text` frames. Required on
       * native-audio models — without this, the spoken response text is never
       * delivered to the client (`modelTurn.parts.text` on native-audio is
       * reasoning, not spoken content).
       */
      output_audio_transcription?: Record<string, never>;
      /**
       * Activity handling tells the server how to react to new user activity
       * while the model is still responding. `START_OF_ACTIVITY_INTERRUPTS`
       * cancels the in-flight model response on barge-in and sets
       * `serverContent.interrupted = true`, which is the signal consumers need
       * to drop queued TTS audio.
       */
      realtime_input_config?: {
        activity_handling?: 'START_OF_ACTIVITY_INTERRUPTS' | 'NO_INTERRUPTION';
      };
      /**
       * Session resumption config. Empty object enables server-issued tokens;
       * { handle } resumes a previous session.
       */
      session_resumption?: { handle?: string };
      /**
       * Opts the session into seeding initial conversation history via send_client_content frames.
       * Must be present in the setup frame for sendContext() to work on gemini-3.1-flash-live-preview
       * and later 3.x models — without it the server closes the WebSocket with code 1007.
       */
      history_config?: {
        initial_history_in_client_content?: boolean;
      };
    }

    // Native-audio models require `response_modalities: ["AUDIO"]` at setup time. This is a voice
    // library, so AUDIO is the only sensible session-level default; callers needing a TEXT-only
    // turn can override per-turn via `GeminiLiveVoiceOptions.responseModalities` on `speak()`.
    const generationConfig: NonNullable<LiveGenerateContentSetup['generation_config']> = {
      response_modalities: ['AUDIO'],
    };

    // Only attach `voice_config` when the caller supplied a `speaker`. Omitting the field lets
    // Gemini Live pick its server-side default and avoids pinning a Mastra-side preference.
    if (this.options.speaker) {
      generationConfig.speech_config = {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: this.options.speaker,
          },
        },
      };
    }

    // Build the Live API setup message
    const setupMessage: { setup: LiveGenerateContentSetup } = {
      setup: {
        model: this.resolveModelIdentifier(),
        generation_config: generationConfig,
        // Transcription is on by default — matches the pattern in @mastra/voice-openai-realtime,
        // @mastra/voice-xai-realtime, and @mastra/voice-inworld where realtime sessions
        // unconditionally enable STT in `connect()`. On native-audio models this is the ONLY way
        // to receive the spoken response as text (`modelTurn.parts.text` carries reasoning, not
        // speech), so without these flags the assistant's words are silently dropped client-side.
        input_audio_transcription: {},
        output_audio_transcription: {},
        // Activity-based interrupts surface barge-in as `serverContent.interrupted = true` and
        // cancel the in-flight model response. This is the only way to wire up the `interrupt`
        // event declared in `GeminiLiveEventMap`.
        realtime_input_config: {
          activity_handling: 'START_OF_ACTIVITY_INTERRUPTS',
        },
        // Session resumption: empty object requests server-issued tokens on new sessions;
        // { handle } resumes a previous session. Only included when enableResumption is set.
        ...(this.options.sessionConfig?.enableResumption && {
          session_resumption: this.isResuming && this.sessionHandle ? { handle: this.sessionHandle } : {},
        }),
        // history_config opts the session into send_client_content-based history seeding.
        // Required by gemini-3.1-flash-live-preview (and later 3.x models) for sendContext() to
        // succeed — without this field in the setup frame the server closes the WebSocket with
        // code 1007 ("Request contains an invalid argument."). Defaults to true so that
        // sendContext() works out of the box; set initialHistoryInClientContent: false on
        // sessionConfig to opt out explicitly.
        ...(this.options.sessionConfig?.initialHistoryInClientContent !== false && {
          history_config: {
            initial_history_in_client_content: true,
          },
        }),
      },
    };

    // Add system instructions if provided
    if (this.options.instructions) {
      setupMessage.setup.system_instruction = {
        parts: [{ text: this.options.instructions }],
      };
    }

    // Gemini Live expects a single `tools` entry whose `function_declarations` array holds every
    // tool. The previous shape (one entry per tool, camelCase `functionDeclarations`) was accepted
    // at setup but the model never emitted tool_call frames back to the client.
    const functionDeclarations = this.buildToolDeclarations(this.options.tools, this.tools);

    // Emit tools as a single container with all declarations
    if (functionDeclarations.length > 0) {
      setupMessage.setup.tools = [{ function_declarations: functionDeclarations }];
      this.log('Including tools in setup message', { toolCount: functionDeclarations.length });
    }

    this.log('Sending Live API setup message:', setupMessage);

    try {
      this.sendEvent('setup', setupMessage);
    } catch (error) {
      this.log('Failed to send Live API setup message:', error);
      throw new Error(
        `Failed to send Live API setup message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Wait for Gemini Live session to be created and ready
   * @private
   */
  private waitForSessionCreated(): Promise<void> {
    return new Promise((resolve, reject) => {
      // For Gemini Live API, we need to wait for the setup completion
      // This will be triggered by the setupComplete message type

      let isResolved = false;

      const onSetupComplete = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve();
        }
      };

      const onError = (errorData: { message?: string; code?: string; details?: unknown }) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error(`Session creation failed: ${errorData.message || 'Unknown error'}`));
        }
      };

      const onSessionEnd = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error('Session ended before setup completed'));
        }
      };

      const cleanup = () => {
        this.eventManager.getEventEmitter().removeListener('setupComplete', onSetupComplete as any);
        this.eventManager.getEventEmitter().removeListener('error', onError as any);
        this.eventManager.getEventEmitter().removeListener('sessionEnd', onSessionEnd as any);
      };

      // Listen for setup completion
      this.eventManager.getEventEmitter().once('setupComplete', onSetupComplete as any);
      this.eventManager.getEventEmitter().once('error', onError as any);
      this.eventManager.getEventEmitter().once('sessionEnd', onSessionEnd as any);

      // Add timeout to prevent hanging indefinitely
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error('Session creation timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Get OAuth access token for Vertex AI authentication
   * Implements token caching and automatic refresh
   * @private
   */
  private async getAccessToken(): Promise<string> {
    if (!this.options.vertexAI) {
      throw new Error('getAccessToken should only be called for Vertex AI mode');
    }
    return this.authManager.getAccessToken();
  }

  /**
   * Get the current response ID from the server message
   * This is needed to associate audio chunks with their respective responses.
   * @private
   */
  private getCurrentResponseId(): string | undefined {
    return this.audioStreamManager.getCurrentResponseId();
  }

  /**
   * Set the current response ID for the next audio chunk.
   * This is used to track the response ID for the current turn.
   * @private
   */
  private setCurrentResponseId(responseId: string): void {
    this.audioStreamManager.setCurrentResponseId(responseId);
  }

  /**
   * Send an event to the Gemini Live API with queueing support
   * @private
   */
  private sendEvent(type: string, data: any): void {
    // Handle messages that already have their own structure
    let message: any;
    if (type === 'setup' && data.setup) {
      // For setup messages, use the data as-is
      message = data;
    } else if (type === 'client_content' && data.client_content) {
      // For client_content messages, use the data as-is
      message = data;
    } else if (type === 'realtime_input' && data.realtime_input) {
      // For realtime_input messages, use the data as-is
      message = data;
    } else if (type === 'toolResponse' && data.toolResponse) {
      // For toolResponse messages, use the data as-is
      message = data;
    } else if (type === 'session.update' && data.session) {
      // For session update messages, use the data as-is
      message = data;
    } else {
      // For other messages, create the standard structure
      message = { type: type, ...data };
    }

    if (!this.ws || !this.connectionManager.isConnected()) {
      // Queue the message if WebSocket is not ready
      this.queue.push(message);
      this.log('Queued message:', { type, data });
    } else {
      // Send immediately if WebSocket is ready
      this.connectionManager.send(JSON.stringify(message));
      this.log('Sent message:', { type, data });
    }
  }

  /**
   * Equip the voice provider with tools
   * @param tools Object containing tool definitions that can be called by the voice model
   *
   * @example
   * ```typescript
   * const weatherTool = createTool({
   *   id: "getWeather",
   *   description: "Get the current weather for a location",
   *   inputSchema: z.object({
   *     location: z.string().describe("The city and state, e.g. San Francisco, CA"),
   *   }),
   *   execute: async (inputData) => {
   *     // Fetch weather data from an API
   *     const response = await fetch(
   *       `https://api.weather.com?location=${encodeURIComponent(inputData.location)}`,
   *     );
   *     const data = await response.json();
   *     return {
   *       message: `The current temperature in ${inputData.location} is ${data.temperature}°F with ${data.conditions}.`,
   *     };
   *   },
   * });
   *
   * voice.addTools({
   *   getWeather: weatherTool,
   * });
   * ```
   */
  addTools(tools: ToolsInput): void {
    this.tools = tools;
    this.log('Tools added to Gemini Live Voice', { toolCount: Object.keys(tools || {}).length });
  }

  /**
   * Get the current tools configured for this voice instance
   * @returns Object containing the current tools
   */
  listTools(): ToolsInput | undefined {
    return this.tools;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.info(`[GeminiLiveVoice] ${message}`, ...args);
    }
  }

  /**
   * Flatten both tool sources (constructor `tools` option and runtime `addTools()` registry) into
   * the single declaration array Gemini Live expects inside `tools[0].function_declarations`.
   * Used by both `sendInitialConfig()` and `updateSessionConfig()` so mid-session tool updates
   * stay on the same shape as setup-time tools.
   * @private
   */
  private buildToolDeclarations(
    configTools: GeminiToolConfig[] | undefined,
    registeredTools: ToolsInput | undefined,
  ): Array<{ name: string; description?: string; parameters?: unknown }> {
    const declarations: Array<{ name: string; description?: string; parameters?: unknown }> = [];

    if (configTools && configTools.length > 0) {
      for (const tool of configTools) {
        declarations.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }

    if (registeredTools && Object.keys(registeredTools).length > 0) {
      for (const [toolName, tool] of Object.entries(registeredTools)) {
        try {
          let parameters: unknown;
          if ('inputSchema' in tool && tool.inputSchema) {
            if (typeof tool.inputSchema === 'object' && 'safeParse' in tool.inputSchema) {
              parameters = this.convertZodSchemaToJsonSchema(tool.inputSchema);
            } else {
              parameters = tool.inputSchema;
            }
          } else if ('parameters' in tool && tool.parameters) {
            parameters = tool.parameters;
          } else {
            parameters = { type: 'object', properties: {} };
          }

          declarations.push({
            name: toolName,
            description: tool.description || `Tool: ${toolName}`,
            parameters,
          });
        } catch (error) {
          this.log('Failed to process tool', { toolName, error });
        }
      }
    }

    return declarations;
  }

  /**
   * Convert a schema to Gemini-compatible JSON Schema using GoogleSchemaCompatLayer.
   * This ensures the output conforms to the OpenAPI 3.0 Schema Object subset
   * that Gemini's wire validator expects.
   * @private
   */
  private convertZodSchemaToJsonSchema(schema: unknown): unknown {
    try {
      const compat = new GoogleSchemaCompatLayer({
        provider: 'google',
        modelId: 'gemini-live',
        supportsStructuredOutputs: false,
      });
      return compat.processToJSONSchema(schema as any);
    } catch (error) {
      this.log('Failed to convert Zod schema to JSON schema', { error, schema });
      return {
        type: 'object',
        properties: {},
        description: 'Schema conversion failed',
      };
    }
  }

  /**
   * Close the connection (alias for disconnect)
   */
  close(): void {
    void this.disconnect();
  }

  /**
   * Trigger voice provider to respond
   */
  async answer(_options?: Record<string, unknown>): Promise<void> {
    this.validateConnectionState();

    // Send a signal to trigger response generation
    this.sendEvent('response.create', {});
  }

  /**
   * Equip the voice provider with instructions
   * @param instructions Instructions to add
   */
  addInstructions(instructions?: string): void {
    if (instructions) {
      this.options.instructions = instructions;
      this.log('Instructions added:', instructions);
    }
  }
}

export type { IncrementalTurn } from './types';
