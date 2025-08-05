import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { MastraVoice  } from '@mastra/core/voice';
import type {VoiceEventType} from '@mastra/core/voice';
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
} from './types';

/**
 * Default configuration values
 */
const DEFAULT_MODEL: GeminiVoiceModel = 'gemini-2.0-flash-live-001';
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
 * 
 * @example
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
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private sessionHandle?: string;
  
  private readonly apiKey: string;
  private readonly model: GeminiVoiceModel;
  private readonly vertexAI: boolean;
  private readonly project?: string;
  private readonly location: string;
  private readonly instructions?: string;
  private readonly tools?: GeminiToolConfig[];
  private readonly debug: boolean;
  private readonly audioConfig: AudioConfig;

  /**
   * Creates a new GeminiLiveVoice instance
   * 
   * @param config Configuration options
   */
  constructor(config: GeminiLiveVoiceConfig = {}) {
    super({
      speechModel: {
        name: config.model || DEFAULT_MODEL,
        apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
      },
      speaker: config.speaker || DEFAULT_VOICE,
      realtimeConfig: {
        model: config.model || DEFAULT_MODEL,
        apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
        options: config,
      },
    });

    // Validate API key
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey && !config.vertexAI) {
      throw new Error(
        'Google API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey to constructor'
      );
    }

    this.apiKey = apiKey || '';
    this.model = config.model || DEFAULT_MODEL;
    this.vertexAI = config.vertexAI || false;
    this.project = config.project || process.env.GOOGLE_CLOUD_PROJECT;
    this.location = config.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.instructions = config.instructions;
    this.tools = config.tools;
    this.debug = config.debug || false;
    this.audioConfig = DEFAULT_AUDIO_CONFIG;
    
    this.eventEmitter = new EventEmitter();

    if (this.vertexAI && !this.project) {
      throw new Error(
        'Google Cloud project ID is required when using Vertex AI. Set GOOGLE_CLOUD_PROJECT environment variable or pass project to constructor'
      );
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
        return;
      }

      this.connectionState = 'connecting';
      this.emit('session', { state: 'connecting' });

      const wsUrl: string = this.vertexAI
        ? `wss://${this.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.PredictionService.ServerStreamingPredict`
        : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

      const headers: WebSocket.ClientOptions = this.vertexAI
        ? { headers: { 'Authorization': `Bearer ${await this.getAccessToken()}` }}
        : { headers: { 'x-goog-api-key': this.apiKey }};

      this.ws = new WebSocket(wsUrl, undefined, headers);

      this.setupEventListeners();

      await Promise.all([this.waitForOpen(), this.waitForSessionCreated()])

      this.sendInitialConfig();
      this.connectionState = 'connected';
      // TODO: Implement WebSocket connection
      // - Build WebSocket URL (different for Gemini API vs Vertex AI)
      // - Set up authentication headers
      // - Establish connection
      // - Set up message handlers
    }, 'gemini-live.connect')();
  }

  /**
   * Disconnect from the Gemini Live API
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.connectionState = 'disconnected';
    this.emit('session', { state: 'disconnected' });
  }

  /**
   * Send text to be converted to speech
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: GeminiLiveVoiceOptions
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
          turn_complete: true
        }
      };

      try {
        this.ws!.send(JSON.stringify(textMessage));
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

    // TODO: Implement audio streaming
    // - Convert audio to required format (16kHz PCM16)
    // - Send audio chunks via WebSocket
    
    throw new Error('Send method not yet implemented');
  }

  /**
   * Process speech from audio stream (traditional STT interface)
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: GeminiLiveVoiceOptions
  ): Promise<string> {
    return this.traced(async () => {
      // For the Live API, this would typically be handled via the event system
      // This method provides compatibility with the traditional MastraVoice interface
      
      throw new Error('Listen method not yet implemented');
    }, 'gemini-live.listen')();
  }

  /**
   * Get available speakers/voices
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
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
    this.sessionHandle = handle;
    await this.connect();
  }

  /**
   * Send video frame for multimodal processing
   */
  async sendVideo(videoData: Buffer | Uint8Array): Promise<void> {
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
   */
  async updateSessionConfig(config: Partial<GeminiLiveVoiceConfig>): Promise<void> {
    if (this.connectionState !== 'connected') {
      throw new Error('Not connected to Gemini Live API. Call connect() first.');
    }

    // TODO: Implement session configuration updates
    // - Send configuration update message
    
    throw new Error('Session config updates not yet implemented');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Get session handle for resumption
   */
  getSessionHandle(): string | undefined {
    return this.sessionHandle;
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
      this.connectionState = 'connected';
      this.emit('session', { state: 'connected' });
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.log('WebSocket connection closed', { code, reason: reason.toString() });
      this.connectionState = 'disconnected';
      this.emit('session', { state: 'disconnected' });
    });

    this.ws.on('error', (error: Error) => {
      this.log('WebSocket error', error);
      this.connectionState = 'disconnected';
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
  private handleGeminiMessage(data: any): void {
    if (this.debug) {
      this.log('Received message', data);
    }

    // Handle different Gemini Live API message structures
    if (data.setupComplete) {
      this.handleSetupComplete(data);
    } else if (data.server_content) {
      this.handleServerContent(data.server_content);
    } else if (data.toolCall) {
      this.handleToolCall(data);
    } else if (data.usage_metadata) {
      this.handleUsageUpdate(data);
    } else if (data.sessionEnd) {
      this.handleSessionEnd(data);
    } else {
      this.log('Unknown message format', data);
    }
  }

  /**
   * Handle setup completion message
   * @private
   */
  private handleSetupComplete(data: any): void {
    this.log('Setup completed');
    // Emit event for waitForSessionCreated to resolve
    this.eventEmitter.emit('setupComplete', data);
    // Session is now ready for communication
  }

  /**
   * Handle server content (text/audio responses)
   * @private
   */
  private handleServerContent(data: any): void {
    if (data.model_turn?.parts) {
      for (const part of data.model_turn.parts) {
        // Handle text content
        if (part.text) {
          this.emit('writing', { 
            text: part.text, 
            role: 'assistant' 
          });
        }
        
        // Handle audio content
        if (part.inline_data && part.inline_data.mime_type?.includes('audio')) {
          try {
            const int16Array = this.base64ToInt16Array(part.inline_data.data);
            
            this.emit('speaking', {
              audio: part.inline_data.data, // Base64 string
              audioData: int16Array,
              sampleRate: this.audioConfig.outputSampleRate // Gemini Live outputs at 24kHz
            });
          } catch (error) {
            this.log('Failed to process audio data', error);
            this.emit('error', { 
              message: 'Failed to process received audio data', 
              code: 'audio_processing_error', 
              details: error 
            });
          }
        }
      }
    }

    // Check for turn completion
    if (data.turn_complete) {
      this.log('Turn completed');
    }
  }

  /**
   * Handle tool call requests from the model
   * @private
   */
  private handleToolCall(data: any): void {
    if (data.toolCall) {
      this.emit('toolCall', {
        name: data.toolCall.name,
        args: data.toolCall.args || {},
        id: data.toolCall.id || randomUUID()
      });
    }
  }

  /**
   * Handle token usage information
   * @private
   */
  private handleUsageUpdate(data: any): void {
    if (data.usage_metadata) {
      this.emit('usage', {
        inputTokens: data.usage_metadata.prompt_token_count || 0,
        outputTokens: data.usage_metadata.candidates_token_count || 0,
        totalTokens: data.usage_metadata.total_token_count || 0,
        modality: this.determineModality(data)
      });
    }
  }

  /**
   * Handle session end
   * @private
   */
  private handleSessionEnd(data: any): void {
    this.log('Session ended', data.reason);
    this.connectionState = 'disconnected';
    this.emit('session', { state: 'disconnected' });
  }

  /**
   * Determine the modality from message data
   * @private
   */
  private determineModality(data: any): 'audio' | 'text' | 'video' {
    // Simple heuristic - this could be more sophisticated
    if (data.server_content?.model_turn?.parts?.some((part: any) => part.inline_data?.mime_type?.includes('audio'))) {
      return 'audio';
    }
    if (data.server_content?.model_turn?.parts?.some((part: any) => part.inline_data?.mime_type?.includes('video'))) {
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

    // Build the setup message according to the actual Gemini Live API format
    const setupMessage = {
      model: this.model,
      generation_config: {
        response_modalities: ['AUDIO'], // Use string constants as documented
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: this.speaker
            }
          }
        }
      }
    };

    // Add system instructions if provided
    if (this.instructions) {
      (setupMessage as any).system_instruction = {
        parts: [{ text: this.instructions }]
      };
    }

    // Add tools if configured
    if (this.tools && this.tools.length > 0) {
      (setupMessage as any).tools = this.tools.map(tool => ({
        function_declarations: [{
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }]
      }));
    }

    this.log('Sending initial config', setupMessage);
    
    try {
      this.ws.send(JSON.stringify(setupMessage));
    } catch (error) {
      this.log('Failed to send initial config', error);
      throw new Error(`Failed to send initial configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      const onError = (errorData: any) => {
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
   * @private
   */
  private async getAccessToken(): Promise<string> {
    // TODO: Implement proper OAuth token retrieval for Vertex AI
    // This should use Google Cloud authentication (service account or ADC)
    // For now, we'll assume the apiKey is actually an access token for Vertex AI
    if (!this.apiKey) {
      throw new Error('Access token or service account credentials required for Vertex AI');
    }
    return this.apiKey;
  }

  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[GeminiLiveVoice] ${message}`, ...args);
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
  private createAudioMessage(audioData: string, messageType: 'input' | 'realtime' = 'realtime'): any {
    if (messageType === 'input') {
      // For conversation item creation (traditional listen method)
      return {
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: 'audio/pcm',
                    data: audioData
                  }
                }
              ]
            }
          ],
          turn_complete: true
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