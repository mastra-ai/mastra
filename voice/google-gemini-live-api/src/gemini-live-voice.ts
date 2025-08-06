import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { MastraVoice  } from '@mastra/core/voice';
import type {VoiceEventType} from '@mastra/core/voice';
import { GoogleAuth, type OAuth2Client } from 'google-auth-library';
import type { WebSocket as WSType } from 'ws';
import { WebSocket } from 'ws';
import type {
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiLiveEventMap,
  GeminiVoiceModel,
  GeminiVoiceName,
  GeminiToolConfig,
  AudioConfig,
  GeminiLiveServerMessage,
  AuthOptions,
} from './types';

/**
 * Default configuration values
 */
const DEFAULT_MODEL: GeminiVoiceModel = 'gemini-2.0-flash-exp';
const DEFAULT_VOICE: GeminiVoiceName = 'Puck';
const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  encoding: 'pcm16',
  channels: 1,
};

/**
 * GeminiLiveVoice provides real-time multimodal voice interactions using Google's Gemini Live API.
 * 
 * Features:
 * - Bidirectional audio streaming
 * - Video input support
 * - Built-in VAD and interrupt handling
 * - Tool calling capabilities
 * - Session management and resumption
 * - Live transcription
 * - Support for both Gemini API and Vertex AI
 * 
 * @example Using Gemini API (with API key)
 * ```typescript
 * const voice = new GeminiLiveVoice({
 *   apiKey: 'your-api-key',
 *   model: 'gemini-2.0-flash-live-001',
 *   speaker: 'Puck',
 * });
 * 
 * await voice.connect();
 * 
 * voice.on('speaking', ({ audio }) => {
 *   playAudio(audio);
 * });
 * 
 * await voice.speak('Hello!');
 * ```
 * 
 * @example Using Vertex AI (with OAuth)
 * ```typescript
 * const voice = new GeminiLiveVoice({
 *   vertexAI: true,
 *   project: 'your-gcp-project',
 *   location: 'us-central1',
 *   model: 'gemini-2.0-flash-live-001',
 *   // Optional: specify service account
 *   serviceAccountKeyFile: '/path/to/service-account.json',
 * });
 * 
 * await voice.connect();
 * ```
 */
export class GeminiLiveVoice extends MastraVoice<
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiLiveVoiceOptions,
  any,
  GeminiLiveEventMap
> {
  private ws?: WSType;
  private eventEmitter: EventEmitter;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' = 'disconnected';
  private stateTransitionLock = false;
  private readonly debug: boolean;
  private readonly audioConfig: AudioConfig;
  private queue: unknown[] = [];
  
  // OAuth authentication for Vertex AI
  private authClient?: GoogleAuth;
  private oauthClient?: OAuth2Client;
  private accessToken?: string;
  private tokenExpiryTime?: number;

  // Audio chunk concatenation - similar to OpenAI realtime implementation
  private speakerStreams = new Map<string, PassThrough & { id?: string }>();
  private currentResponseId?: string;

  /**
   * Creates a new GeminiLiveVoice instance
   * 
   * @param config Configuration options
   */
  constructor(
    private options: GeminiLiveVoiceConfig = {}
  ) {
    super({
      speechModel: {
        name: options.model || DEFAULT_MODEL,
        apiKey: options.apiKey
      },
      speaker: options.speaker || DEFAULT_VOICE,
      realtimeConfig: {
        model: options.model || DEFAULT_MODEL,
        apiKey: options.apiKey,
        options: options,
      },
    });

    // Validate API key
    const apiKey = options.apiKey
    if (!apiKey && !options.vertexAI) {
      throw new Error(
        'Google API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey to constructor'
      );
    }

    this.debug = options.debug || false;
    
    // Merge provided audio config with defaults
    this.audioConfig = {
      ...DEFAULT_AUDIO_CONFIG,
      ...options.audioConfig
    };
    
    this.eventEmitter = new EventEmitter();

    if (options.vertexAI && !options.project) {
      throw new Error(
        'Google Cloud project ID is required when using Vertex AI. Set GOOGLE_CLOUD_PROJECT environment variable or pass project to constructor'
      );
    }

    // Initialize Google Auth client for Vertex AI
    if (options.vertexAI) {
      const authOptions: AuthOptions = {
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId: options.project,
      };

      // Use service account key file if provided
      if (options.serviceAccountKeyFile) {
        authOptions.keyFilename = options.serviceAccountKeyFile;
        this.log('Using service account key file for authentication:', options.serviceAccountKeyFile);
      }

      // Use service account email for impersonation if provided
      if (options.serviceAccountEmail) {
        authOptions.clientOptions = {
          subject: options.serviceAccountEmail,
        };
        this.log('Using service account impersonation:', options.serviceAccountEmail);
      }

      this.authClient = new GoogleAuth(authOptions);
    }
  }

  /**
   * Register an event listener
   * @param event Event name
   * @param callback Callback function that receives event data
   */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void,
  ): void {
    this.eventEmitter.on(event as string, callback);
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
    this.eventEmitter.off(event as string, callback);
  }

  /**
   * Emit an event to listeners
   * @private
   */
  private emit<K extends keyof GeminiLiveEventMap>(
    event: K,
    data: GeminiLiveEventMap[K]
  ): boolean {
    return this.eventEmitter.emit(event as string, data);
  }

  /**
   * Establish connection to the Gemini Live API
   */
  async connect(): Promise<void> {
    return this.traced(async () => {
      if (this.connectionState === 'connected') {
        this.log('Already connected');
        return;
      }

      if (this.connectionState === 'connecting') {
        this.log('Connection already in progress');
        return;
      }

      if (!this.transitionState(null, 'connecting')) {
        throw new Error('Cannot start connection from current state: ' + this.connectionState);
      }

      // Build WebSocket URL based on official Gemini Live API documentation
      let wsUrl: string;
      let headers: WebSocket.ClientOptions = {};

      if (this.options.vertexAI) {
        // Vertex AI endpoint
        wsUrl = `wss://${this.options.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.PredictionService.ServerStreamingPredict`;
        const accessToken = await this.getAccessToken();
        headers = { headers: { 'Authorization': `Bearer ${accessToken}` }};
      } else {
        // Live API endpoint - this is specifically for the Live API
        // Based on the official documentation, the Live API uses a different endpoint
        wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
        headers = { 
          headers: { 
            'x-goog-api-key': this.options.apiKey || '',
            'Content-Type': 'application/json'
          }
        };
      }

      this.log('Connecting to:', wsUrl);
      this.ws = new WebSocket(wsUrl, undefined, headers);

      this.setupEventListeners();

      // Wait for WebSocket connection to open
      await this.waitForOpen();
      
      // Send initial configuration
      this.sendInitialConfig();
      
      // Wait for session to be created after sending config
      await this.waitForSessionCreated();
      
      if (!this.transitionState('connecting', 'connected')) {
        this.log('Warning: Failed to transition to connected state');
      }
    }, 'gemini-live.connect')();
  }

  /**
   * Disconnect from the Gemini Live API
   */
  async disconnect(): Promise<void> {
    if (this.connectionState === 'disconnected' || this.connectionState === 'disconnecting') {
      this.log('Already disconnected or disconnecting');
      return;
    }

    // Transition to disconnecting state
    if (!this.transitionState(null, 'disconnecting')) {
      this.log('Warning: Could not transition to disconnecting state');
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    // Clean up speaker streams
    for (const [responseId, stream] of this.speakerStreams.entries()) {
      stream.end();
      this.speakerStreams.delete(responseId);
    }
    
    // Clear current response ID
    this.currentResponseId = undefined;
    
    // Clear cached OAuth token
    this.accessToken = undefined;
    this.tokenExpiryTime = undefined;
    
    // Final transition to disconnected
    if (!this.transitionState('disconnecting', 'disconnected')) {
      // Force disconnect if state transition fails
      this.connectionState = 'disconnected';
      this.emit('session', { state: 'disconnected' });
    }
  }

  /**
   * Send text to be converted to speech
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    _options?: GeminiLiveVoiceOptions
  ): Promise<NodeJS.ReadableStream | void> {
    return this.traced(async () => {
      if (this.connectionState !== 'connected') {
        throw new Error('Not connected to Gemini Live API. Call connect() first.');
      }

      if (typeof input !== 'string') {
        const chunks: Buffer[] = [];
        for await (const chunk of input) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
        }
        input = Buffer.concat(chunks).toString('utf-8');
      }

      if (input.trim().length === 0) {
        throw new Error('Input text is empty');
      }

      // Send text message to Gemini Live API
      const textMessage = {
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: input
                }
              ]
            }
          ],
          turnComplete: true
        }
      };

      try {
        this.sendEvent('client_content', textMessage);
        this.log('Text message sent', { text: input });
        
        // The response will come via the event system (handleServerContent)
        // Audio will be emitted through 'speaking' events
        // Text responses will be emitted through 'writing' events
        
      } catch (error) {
        this.log('Failed to send text message', error);
        throw new Error(`Failed to send text message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 'gemini-live.speak')();
  }

  /**
   * Send audio stream for processing
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (this.connectionState !== 'connected') {
      throw new Error('Not connected to Gemini Live API. Call connect() first.');
    }

    if ('readable' in audioData && typeof audioData.on === 'function') {
      const stream = audioData as NodeJS.ReadableStream;

      stream.on('data', (chunk: Buffer) => {
        try {
          const base64Audio = this.processAudioChunk(chunk);
          const message = this.createAudioMessage(base64Audio, 'realtime');
          this.sendEvent('realtime_input', message);
        } catch (error) {
          this.log('Failed to process audio chunk', error);
          this.emit('error', {
            message: 'Failed to process audio chunk',
            code: 'audio_processing_error',
            details: error
          });
        }
      });

      stream.on('error', (error: Error) => {
        this.log('Audio stream error', error);
        this.emit('error', {
          message: 'Audio stream error',
          code: 'audio_stream_error',
          details: error
        });
      });

      stream.on('end', () => {
        this.log('Audio stream ended');
      });
    } else {
      const validateAudio = this.validateAndConvertAudioInput(audioData as Int16Array);
      const base64Audio = this.int16ArrayToBase64(validateAudio);
      const message = this.createAudioMessage(base64Audio, 'realtime');
      this.sendEvent('realtime_input', message);
    }
  }

  /**
   * Process speech from audio stream (traditional STT interface)
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    _options?: GeminiLiveVoiceOptions
  ): Promise<string> {
    return this.traced(async () => {
      if (this.connectionState !== 'connected') {
        throw new Error('Not connected to Gemini Live API. Call connect() first.');
      }

      return new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let transcriptionText = '';
        let hasReceivedResponse = false;
        let checkResponseTimer: NodeJS.Timeout | undefined;
        let isCleanedUp = false;
        let totalBufferSize = 0;
        
        // Maximum buffer size: 50MB (reasonable for audio files)
        const MAX_BUFFER_SIZE = 50 * 1024 * 1024;

        // Set up timeout
        const timeout = setTimeout(() => {
          if (!hasReceivedResponse) {
            cleanup();
            reject(new Error('Transcription timeout - no response received within 30 seconds'));
          }
        }, 30000);

        // Stream event handlers
        const onStreamData = (chunk: Buffer) => {
          try {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            
            // Check buffer size to prevent memory overflow
            totalBufferSize += buffer.length;
            if (totalBufferSize > MAX_BUFFER_SIZE) {
              cleanup();
              reject(new Error(`Audio data exceeds maximum size of ${MAX_BUFFER_SIZE / (1024 * 1024)}MB`));
              return;
            }
            
            chunks.push(buffer);
          } catch (error) {
            cleanup();
            reject(new Error(`Failed to process audio chunk: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };

        const onStreamError = (error: Error) => {
          cleanup();
          reject(new Error(`Audio stream error: ${error.message}`));
        };

        const onStreamEnd = async () => {
          try {
            // Remove stream listeners as we're done with the stream
            audioStream.removeListener('data', onStreamData);
            audioStream.removeListener('error', onStreamError);

            // Combine all chunks
            const audioBuffer = Buffer.concat(chunks);
            this.log('Processing audio for transcription:', { 
              chunks: chunks.length,
              totalSize: audioBuffer.length,
              duration: audioBuffer.length / (this.audioConfig.inputSampleRate * 2) // Approximate duration in seconds
            });

            // Validate audio format
            if (audioBuffer.length % 2 !== 0) {
              throw new Error('Invalid audio data: buffer length must be even for 16-bit audio');
            }

            // Convert to base64
            const base64Audio = audioBuffer.toString('base64');

            // Create audio message for transcription
            const message = this.createAudioMessage(base64Audio, 'input');
            
            // Send to Gemini Live API
            this.sendEvent('client_content', message);
            this.log('Sent audio for transcription');

            // Wait for transcription response
            const checkResponse = () => {
              if (transcriptionText.length > 0) {
                hasReceivedResponse = true;
                cleanup();
                resolve(transcriptionText.trim());
              } else if (!hasReceivedResponse && !isCleanedUp) {
                // Check again in 100ms, but don't check forever
                checkResponseTimer = setTimeout(checkResponse, 100);
              }
            };

            // Start checking for response after a short delay
            checkResponseTimer = setTimeout(checkResponse, 100);

          } catch (error) {
            cleanup();
            reject(new Error(`Failed to process audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };

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
          cleanup();
          reject(new Error(`Transcription failed: ${error.message}`));
        };

        // Listen for session events
        const onSession = (data: { state: string }) => {
          if (data.state === 'disconnected') {
            cleanup();
            reject(new Error('Session disconnected during transcription'));
          }
        };

        // Comprehensive cleanup function
        const cleanup = () => {
          if (isCleanedUp) return; // Prevent double cleanup
          isCleanedUp = true;

          // Clear all timers
          clearTimeout(timeout);
          if (checkResponseTimer) {
            clearTimeout(checkResponseTimer);
            checkResponseTimer = undefined;
          }

          // Remove GeminiLiveVoice event listeners
          this.off('writing', onWriting);
          this.off('error', onError);
          this.off('session', onSession);

          // Remove stream event listeners
          audioStream.removeListener('data', onStreamData);
          audioStream.removeListener('error', onStreamError);
          audioStream.removeListener('end', onStreamEnd);

          // Clear chunks array to free memory
          chunks.length = 0;
        };

        // Set up GeminiLiveVoice event listeners
        this.on('writing', onWriting);
        this.on('error', onError);
        this.on('session', onSession);

        // Set up stream event listeners
        audioStream.on('data', onStreamData);
        audioStream.on('error', onStreamError);
        audioStream.on('end', onStreamEnd);

        // Handle stream close event (in case stream is closed without ending)
        audioStream.once('close', () => {
          if (!hasReceivedResponse && !isCleanedUp) {
            cleanup();
            reject(new Error('Audio stream closed unexpectedly'));
          }
        });
      });
    }, 'gemini-live.listen')();
  }

  /**
   * Get available speakers/voices
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; description?: string }>> {
    return this.traced(async () => {
      // Return available Gemini Live voices
      return [
        { voiceId: 'Puck', description: 'Conversational, friendly' },
        { voiceId: 'Charon', description: 'Deep, authoritative' },
        { voiceId: 'Kore', description: 'Neutral, professional' },
        { voiceId: 'Fenrir', description: 'Warm, approachable' },
      ];
    }, 'gemini-live.getSpeakers')();
  }

  /**
   * Resume a previous session using a session handle
   */
  async resumeSession(handle: string): Promise<void> {
    // TODO: Implement session resumption when Gemini Live API supports it
    this.log('Session resumption not yet implemented for Gemini Live API');
    await this.connect();
  }

  /**
   * Send video frame for multimodal processing
   */
  async sendVideo(_videoData: Buffer | Uint8Array): Promise<void> {
    if (this.connectionState !== 'connected') {
      throw new Error('Not connected to Gemini Live API. Call connect() first.');
    }

    // TODO: Implement video streaming
    // - Convert video frame to JPEG format
    // - Send via WebSocket with appropriate metadata
    
    throw new Error('Video streaming not yet implemented');
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
    if (this.connectionState !== 'connected') {
      throw new Error('Not connected to Gemini Live API. Call connect() first.');
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    return new Promise((resolve, reject) => {
      // Validate configuration
      if (config.model) {
        this.log('Warning: Model cannot be changed during an active session. Ignoring model update.');
      }

      if (config.vertexAI !== undefined || config.project !== undefined || config.location !== undefined) {
        this.log('Warning: Authentication settings cannot be changed during an active session.');
      }

      // Build the update message
      interface UpdateMessage {
        type: string;
        session: {
          generation_config?: {
            speech_config?: {
              voice_config?: {
                prebuilt_voice_config?: {
                  voice_name: string;
                };
              };
            };
          };
          system_instruction?: {
            parts: Array<{ text: string }>;
          };
          tools?: Array<{
            function_declarations: Array<{
              name: string;
              description?: string;
              parameters?: unknown;
            }>;
          }>;
          vad?: {
            enabled: boolean;
            sensitivity?: number;
            silence_duration_ms?: number;
          };
          interrupts?: {
            enabled: boolean;
            allow_user_interruption?: boolean;
          };
          context_compression?: boolean;
        };
      }
      
      const updateMessage: UpdateMessage = {
        type: 'session.update',
        session: {}
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
                voice_name: config.speaker
              }
            }
          }
        };
        
        // Update internal state
        this.speaker = config.speaker;
        this.log('Updating speaker to:', config.speaker);
      }

      // Update instructions if provided
      if (config.instructions !== undefined) {
        hasUpdates = true;
        updateMessage.session.system_instruction = {
          parts: [{ text: config.instructions }]
        };
        
        this.log('Updating instructions');
      }

      // Update tools if provided
      if (config.tools !== undefined) {
        hasUpdates = true;
        if (config.tools.length > 0) {
          updateMessage.session.tools = config.tools.map((tool: GeminiToolConfig) => ({
            function_declarations: [{
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }]
          }));
        } else {
          // Clear tools if empty array provided
          updateMessage.session.tools = [];
        }
        
        this.log('Updating tools:', config.tools.length, 'tools');
      }

      // Update session configuration if provided
      if (config.sessionConfig) {
        // Handle VAD settings
        if (config.sessionConfig.vad) {
          hasUpdates = true;
          updateMessage.session.vad = {
            enabled: config.sessionConfig.vad.enabled ?? true,
            sensitivity: config.sessionConfig.vad.sensitivity ?? 0.5,
            silence_duration_ms: config.sessionConfig.vad.silenceDurationMs ?? 1000
          };
          this.log('Updating VAD settings:', config.sessionConfig.vad);
        }

        // Handle interrupt settings
        if (config.sessionConfig.interrupts) {
          hasUpdates = true;
          updateMessage.session.interrupts = {
            enabled: config.sessionConfig.interrupts.enabled ?? true,
            allow_user_interruption: config.sessionConfig.interrupts.allowUserInterruption ?? true
          };
          this.log('Updating interrupt settings:', config.sessionConfig.interrupts);
        }

        // Handle context compression
        if (config.sessionConfig.contextCompression !== undefined) {
          hasUpdates = true;
          updateMessage.session.context_compression = config.sessionConfig.contextCompression;
          this.log('Updating context compression:', config.sessionConfig.contextCompression);
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
        this.eventEmitter.removeListener('session.updated', onSessionUpdated);
        this.eventEmitter.removeListener('error', onError);
      };

      this.eventEmitter.once('session.updated', onSessionUpdated);
      this.eventEmitter.once('error', onError);

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
   * Thread-safe access to connection state
   */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'disconnecting' {
    return this.connectionState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Check if currently connecting
   */
  isConnecting(): boolean {
    return this.connectionState === 'connecting';
  }

  /**
   * Check if currently disconnecting
   */
  isDisconnecting(): boolean {
    return this.connectionState === 'disconnecting';
  }

  /**
   * Get current speaker stream for audio concatenation
   * This allows external access to the current audio stream being built
   */
  getCurrentSpeakerStream(): NodeJS.ReadableStream | null {
    const currentResponseId = this.getCurrentResponseId();
    if (!currentResponseId) {
      return null;
    }
    
    const currentStream = this.speakerStreams.get(currentResponseId);
    return currentStream ? (currentStream as NodeJS.ReadableStream) : null;
  }

  /**
   * Get session handle for resumption
   */
  getSessionHandle(): string | undefined {
    // TODO: Return actual session handle when Gemini Live API supports session resumption
    return undefined;
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
      // Transition to disconnected state
      if (this.connectionState !== 'disconnected' && this.connectionState !== 'disconnecting') {
        if (!this.transitionState(null, 'disconnected')) {
          // Force disconnect if state transition fails
          this.connectionState = 'disconnected';
          this.emit('session', { state: 'disconnected' });
        }
      }
    });

    this.ws.on('error', (error: Error) => {
      this.log('WebSocket error', error);
      // Transition to disconnected on error
      if (this.connectionState !== 'disconnected' && this.connectionState !== 'disconnecting') {
        if (!this.transitionState(null, 'disconnected')) {
          // Force disconnect if state transition fails
          this.connectionState = 'disconnected';
          this.emit('session', { state: 'disconnected' });
        }
      }
      this.emit('error', { 
        message: error.message, 
        code: 'websocket_error', 
        details: error 
      });
    });

    // Handle incoming messages from Gemini Live API
    this.ws.on('message', (message: Buffer | string) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleGeminiMessage(data);
      } catch (error) {
        this.log('Failed to parse WebSocket message', error);
        this.emit('error', { 
          message: 'Failed to parse WebSocket message', 
          code: 'parse_error', 
          details: error
        });
      }
    });
  }

  /**
   * Handle different types of messages from Gemini Live API
   * @private
   */
  private handleGeminiMessage(data: GeminiLiveServerMessage): void {
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
      this.handleToolCall(data);
    } else if (data.usageMetadata) {
      this.log('Processing usage metadata message');
      this.handleUsageUpdate(data);
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
      } else if (messageData.session || messageData.ready || messageData.status === 'ready' || messageData.status === 'setup_complete') {
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
        this.ws?.send(JSON.stringify(queuedMessage));
        this.log('Sent queued message:', queuedMessage);
      }
    }
    
    // Emit event for waitForSessionCreated to resolve
    this.eventEmitter.emit('setupComplete', data);
    // Session is now ready for communication
  }

  /**
   * Handle session update confirmation
   * @private
   */
  private handleSessionUpdated(data: GeminiLiveServerMessage): void {
    this.log('Session updated', data);
    // Emit event for updateSessionConfig to resolve
    this.eventEmitter.emit('session.updated', data);
    
    // Also emit a general session event for any external listeners
    this.emit('session', { 
      state: 'updated',
      config: data as Record<string, unknown>
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
    
    if (data.modelTurn?.parts) {
      for (const part of data.modelTurn.parts) {
        // Handle text content
        if (part.text) {
          this.emit('writing', {
            text: part.text,
            role: 'assistant'
          });
        }
        
        // Handle audio content - implement chunk concatenation with proper response ID tracking
        if (part.inlineData?.mimeType?.includes('audio') && typeof part.inlineData.data === 'string') {
          try {
            const audioData = part.inlineData.data;
            const int16Array = this.base64ToInt16Array(audioData);
            
            // Use the tracked response ID or generate one if not available
            const responseId = this.getCurrentResponseId() || randomUUID();
            
            // Get or create the speaker stream for this response
            let speakerStream = this.speakerStreams.get(responseId);
            if (!speakerStream) {
              speakerStream = new PassThrough() as PassThrough & { id?: string };
              speakerStream.id = responseId;
              this.speakerStreams.set(responseId, speakerStream);
              
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
              totalStreams: this.speakerStreams.size 
            });
            
            // Also emit the individual speaking event for backward compatibility
            this.emit('speaking', {
              audio: audioData, // Base64 string
              audioData: int16Array,
              sampleRate: this.audioConfig.outputSampleRate // Gemini Live outputs at 24kHz
            });
          } catch (error) {
            this.log('Error processing audio data:', error);
            this.emit('error', {
              message: 'Failed to process audio data',
              code: 'audio_processing_error',
              details: error
            });
          }
        }
      }
    }

    // Check for turn completion
    if (data.turnComplete) {
      this.log('Turn completed');
      
      // End all active speaker streams for this turn
      for (const [responseId, stream] of this.speakerStreams.entries()) {
        stream.end();
        this.speakerStreams.delete(responseId);
        this.log('Ended speaker stream for response:', responseId);
      }
      
      // Clear the current response ID
      this.currentResponseId = undefined;
    }
  }

  /**
   * Handle tool call requests from the model
   * @private
   */
  private handleToolCall(data: GeminiLiveServerMessage): void {
    if (data.toolCall) {
      this.emit('toolCall', {
        name: data.toolCall.name || '',
        args: data.toolCall.args || {},
        id: data.toolCall.id || randomUUID()
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
        modality: this.determineModality(data)
      });
    }
  }

  /**
   * Handle session end
   * @private
   */
  private handleSessionEnd(data: GeminiLiveServerMessage): void {
    this.log('Session ended', data.sessionEnd?.reason);
    if (!this.transitionState(null, 'disconnected')) {
      // Force disconnect if state transition fails
      this.connectionState = 'disconnected';
      this.emit('session', { state: 'disconnected' });
    }
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
      details: error.details
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
    if (data.serverContent?.modelTurn?.parts?.some(part => part.inlineData?.mimeType?.includes('video'))) {
      return 'video';
    }
    return 'text';
  }

  /**
   * Send initial configuration to Gemini Live API
   * @private
   */
  private sendInitialConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Live API format - based on the official documentation
    interface LiveGenerateContentSetup {
      model?: string;
      generationConfig?: {
        temperature?: number;
        topK?: number;
        topP?: number;
        maxOutputTokens?: number;
        stopSequences?: string[];
        candidateCount?: number;
        responseModalities?: string[];
        speechConfig?: {
          voiceConfig?: {
            prebuiltVoiceConfig?: {
              voiceName?: string;
            };
          };
        };
      };
      systemInstruction?: {
        parts: Array<{
          text: string;
        }>;
      };
      tools?: Array<{
        functionDeclarations: Array<{
          name: string;
          description?: string;
          parameters?: unknown;
        }>;
      }>;
    }

    // Build the Live API setup message
    const setupMessage: { setup: LiveGenerateContentSetup } = {
      setup: {
        model: `models/${this.options.model}`
      }
    };

    // Add system instructions if provided
    if (this.options.instructions) {
      setupMessage.setup.systemInstruction = {
        parts: [{ text: this.options.instructions }]
      };
    }

    // Add tools if configured
    if (this.options.tools && this.options.tools.length > 0) {
      setupMessage.setup.tools = this.options.tools.map((tool: GeminiToolConfig) => ({
        functionDeclarations: [{
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }]
      }));
    }

    this.log('Sending Live API setup message:', setupMessage);
    
    try {
      this.sendEvent('setup', setupMessage);
    } catch (error) {
      this.log('Failed to send Live API setup message:', error);
      throw new Error(`Failed to send Live API setup message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for WebSocket connection to open
   * @private
   */
  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      // If already open, resolve immediately
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Set up event listeners with cleanup
      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      };

      const onClose = () => {
        cleanup();
        reject(new Error('WebSocket connection closed before opening'));
      };

      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        this.ws?.removeListener('close', onClose);
      };

      // Add event listeners
      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
      this.ws.once('close', onClose);

      // Add timeout to prevent hanging indefinitely
      setTimeout(() => {
        cleanup();
        reject(new Error('WebSocket connection timeout'));
      }, 30000); // 30 second timeout
    });
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
        this.eventEmitter.removeListener('setupComplete', onSetupComplete);
        this.eventEmitter.removeListener('error', onError);
        this.eventEmitter.removeListener('sessionEnd', onSessionEnd);
      };

      // Listen for setup completion
      this.eventEmitter.once('setupComplete', onSetupComplete);
      this.eventEmitter.once('error', onError);
      this.eventEmitter.once('sessionEnd', onSessionEnd);

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

    if (!this.authClient) {
      throw new Error('Google Auth client not initialized');
    }

    try {
      // Check if we have a cached token that's still valid
      if (this.accessToken && this.tokenExpiryTime) {
        const now = Date.now();
        // Refresh token if it expires in less than 5 minutes
        const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        if (now < this.tokenExpiryTime - bufferTime) {
          this.log('Using cached access token');
          return this.accessToken;
        }
      }

      this.log('Fetching new access token from Google Auth');

      // Get the OAuth2 client
      if (!this.oauthClient) {
        const client = await this.authClient.getClient();
        // Ensure we have an OAuth2Client for token management
        if (!('getAccessToken' in client)) {
          throw new Error('Auth client does not support OAuth2 access tokens');
        }
        this.oauthClient = client as OAuth2Client;
      }

      // Get the access token
      const accessTokenResponse = await this.oauthClient.getAccessToken();
      
      if (!accessTokenResponse.token) {
        throw new Error('Failed to obtain access token from Google Auth');
      }

      // Cache the token and its expiry time
      this.accessToken = accessTokenResponse.token;
      
      // The response includes the expiry time as a timestamp
      if (accessTokenResponse.res?.data?.expires_in) {
        // expires_in is in seconds, convert to milliseconds and add to current time
        this.tokenExpiryTime = Date.now() + (accessTokenResponse.res.data.expires_in * 1000);
      } else {
        // Default to 1 hour if expiry time is not provided
        this.tokenExpiryTime = Date.now() + (60 * 60 * 1000);
      }

      this.log('Successfully obtained access token', { 
        expiresIn: accessTokenResponse.res?.data?.expires_in || 3600,
        tokenType: accessTokenResponse.res?.data?.token_type || 'Bearer'
      });

      return this.accessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to get access token', error);
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('Could not load the default credentials')) {
        throw new Error(
          'No Google Cloud credentials found. Please set up Application Default Credentials (ADC) by:\n' +
          '1. Installing gcloud CLI and running: gcloud auth application-default login\n' +
          '2. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable to point to a service account key file\n' +
          '3. Or run this code on Google Cloud Platform (GCP) with appropriate IAM roles'
        );
      } else if (errorMessage.includes('Request had insufficient authentication scopes')) {
        throw new Error(
          'Insufficient authentication scopes. Ensure the service account or user has the required permissions:\n' +
          '- aiplatform.endpoints.predict\n' +
          '- aiplatform.models.predict'
        );
      }
      
      throw new Error(`Failed to obtain Vertex AI access token: ${errorMessage}`);
    }
  }

  /**
   * Get the current response ID from the server message
   * This is needed to associate audio chunks with their respective responses.
   * @private
   */
  private getCurrentResponseId(): string | undefined {
    return this.currentResponseId;
  }

  /**
   * Set the current response ID for the next audio chunk.
   * This is used to track the response ID for the current turn.
   * @private
   */
  private setCurrentResponseId(responseId: string): void {
    this.currentResponseId = responseId;
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
    } else if (type === 'session.update' && data.session) {
      // For session update messages, use the data as-is
      message = data;
    } else {
      // For other messages, create the standard structure
      message = { type: type, ...data };
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue the message if WebSocket is not ready
      this.queue.push(message);
      this.log('Queued message:', { type, data });
    } else {
      // Send immediately if WebSocket is ready
      this.ws?.send(JSON.stringify(message));
      this.log('Sent message:', { type, data });
    }
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[GeminiLiveVoice] ${message}`, ...args);
    }
  }

  /**
   * Atomically transition the connection state
   * Prevents race conditions and ensures valid state transitions
   * @private
   */
  private transitionState(
    from: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | null,
    to: 'disconnected' | 'connecting' | 'connected' | 'disconnecting'
  ): boolean {
    // Use a simple lock to ensure atomicity
    if (this.stateTransitionLock) {
      this.log(`State transition blocked: currently transitioning`);
      return false;
    }

    this.stateTransitionLock = true;
    try {
      // If 'from' is specified, validate current state
      if (from !== null && this.connectionState !== from) {
        this.log(`Invalid state transition: expected ${from}, but current state is ${this.connectionState}`);
        return false;
      }

      // Validate the transition is allowed
      const validTransitions: Record<string, string[]> = {
        'disconnected': ['connecting'],
        'connecting': ['connected', 'disconnecting', 'disconnected'], // Can fail and go directly to disconnected
        'connected': ['disconnecting', 'disconnected'], // Can lose connection suddenly
        'disconnecting': ['disconnected']
      };

      if (!validTransitions[this.connectionState]?.includes(to)) {
        this.log(`Invalid state transition: ${this.connectionState} -> ${to}`);
        return false;
      }

      // Perform the state transition
      const oldState = this.connectionState;
      this.connectionState = to;
      this.log(`State transition: ${oldState} -> ${to}`);

      // Emit state change event
      this.emit('session', { state: to });

      return true;
    } finally {
      this.stateTransitionLock = false;
    }
  }

  /**
   * Convert Int16Array audio data to base64 string for WebSocket transmission
   * @private
   */
  private int16ArrayToBase64(int16Array: Int16Array): string {
    const buffer = new ArrayBuffer(int16Array.length * 2);
    const view = new DataView(buffer);
    
    // Convert Int16Array to bytes with little-endian format
    for (let i = 0; i < int16Array.length; i++) {
      view.setInt16(i * 2, int16Array[i]!, true);
    }
  
    const nodeBuffer = Buffer.from(buffer);
    return nodeBuffer.toString('base64');
  }

  /**
   * Convert base64 string to Int16Array audio data
   * @private
   */
  private base64ToInt16Array(base64Audio: string): Int16Array {
    try {
      const buffer = Buffer.from(base64Audio, 'base64');
      
      // Convert Buffer to Int16Array
      if (buffer.length % 2 !== 0) {
        throw new Error('Invalid audio data: buffer length must be even for 16-bit audio');
      }
      
      return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    } catch (error) {
      throw new Error(`Failed to decode base64 audio data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and convert audio data to the required format for Gemini Live API
   * Gemini Live expects 16kHz PCM16 for input
   * @private
   */
  private validateAndConvertAudioInput(audioData: Buffer | Int16Array): Int16Array {
    if (Buffer.isBuffer(audioData)) {
      // Convert Buffer to Int16Array
      if (audioData.length % 2 !== 0) {
        throw new Error('Audio buffer length must be even for 16-bit audio');
      }
      return new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
    }
    
    if (audioData instanceof Int16Array) {
      return audioData;
    }
    
    throw new Error('Unsupported audio data format. Expected Buffer or Int16Array');
  }

  /**
   * Process audio chunk for streaming - handles format validation and conversion
   * @private
   */
  private processAudioChunk(chunk: Buffer | Uint8Array | Int16Array): string {
    let int16Array: Int16Array;
    
    if (chunk instanceof Int16Array) {
      int16Array = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      if (chunk.length % 2 !== 0) {
        throw new Error('Audio chunk length must be even for 16-bit audio');
      }
      int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 2);
    } else if (chunk instanceof Uint8Array) {
      if (chunk.length % 2 !== 0) {
        throw new Error('Audio chunk length must be even for 16-bit audio');
      }
      int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 2);
    } else {
      throw new Error('Unsupported audio chunk format');
    }

    return this.int16ArrayToBase64(int16Array);
  }

  /**
   * Validate audio format and sample rate for Gemini Live API requirements
   * @private
   */
  private validateAudioFormat(sampleRate?: number, channels?: number): void {
    if (sampleRate && sampleRate !== this.audioConfig.inputSampleRate) {
      this.log(`Warning: Audio sample rate ${sampleRate}Hz does not match expected ${this.audioConfig.inputSampleRate}Hz`);
    }
    
    if (channels && channels !== this.audioConfig.channels) {
      throw new Error(`Unsupported channel count: ${channels}. Gemini Live API requires mono audio (1 channel)`);
    }
  }

  /**
   * Create an audio message for the Gemini Live API
   * @private
   */
  private createAudioMessage(audioData: string, messageType: 'input' | 'realtime' = 'realtime'): Record<string, unknown> {
    if (messageType === 'input') {
      // For conversation item creation (traditional listen method)
      return {
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/pcm',
                    data: audioData
                  }
                }
              ]
            }
          ],
          turnComplete: true
        }
      };
    } else {
      // For real-time streaming
      return {
        realtime_input: {
          media_chunks: [
            {
              mime_type: 'audio/pcm',
              data: audioData
            }
          ]
        }
      };
    }
  }
}