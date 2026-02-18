import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { MastraVoice } from '@mastra/core/voice';
import type { VoiceConfig, VoiceEventType } from '@mastra/core/voice';
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  NodeHttp2Handler,
} from '@smithy/node-http-handler';

import type { AwsCredentialIdentity } from '@smithy/types';
import type {
  NovaSonicVoiceConfig as ConfigType,
  NovaSonicVoiceOptions,
  NovaSonicEventMap,
  NovaSonicServerEvent,
  NovaSonicClientEvent,
  NovaSonicRegion,
} from './types';
import { NovaSonicErrorCode as ErrorCode } from './types';
import { NovaSonicError } from './utils/errors';

// Re-export for consumer usage (error handling, type checking)
export { NovaSonicError } from './utils/errors';
export { NovaSonicErrorCode } from './types';
export type { NovaSonicVoiceConfig, NovaSonicSessionConfig, NovaSonicToolConfig, NovaSonicVoiceOptions } from './types';
import { getAwsCredentials } from './utils/auth';

/**
 * Default configuration values
 */
const DEFAULT_MODEL = 'amazon.nova-2-sonic-v1:0';
const DEFAULT_REGION: NovaSonicRegion = 'us-east-1';

/**
 * Event callback function type
 */
type EventCallback = (...args: any[]) => void;

type StreamWithId = PassThrough & { id: string };

/**
 * Map of event types to their callback arrays
 */
type EventMap = Record<string, EventCallback[]>;

/**
 * NovaSonicVoice provides real-time voice interaction capabilities using AWS Nova 2 Sonic's
 * bidirectional streaming API. It supports:
 * - Real-time text-to-speech
 * - Speech-to-text (transcription)
 * - Voice activity detection
 * - Multiple voice options and languages
 * - Polyglot voices
 * - Tool/function calling
 * - Cross-modal input (audio and text)
 *
 * The class manages HTTP/2 bidirectional streaming connections, audio streaming, and event handling
 * for seamless voice interactions.
 *
 * @extends MastraVoice
 *
 * @example
 * ```typescript
 * const voice = new NovaSonicVoice({
 *   region: 'us-east-1',
 *   model: 'amazon.nova-2-sonic-v1:0',
 *   speaker: 'default',
 * });
 *
 * await voice.connect();
 * voice.on('speaking', ({ audio }) => {
 *   // Handle audio data
 * });
 *
 * await voice.speak('Hello, how can I help you today?');
 * ```
 */
export class NovaSonicVoice extends MastraVoice<
  ConfigType,
  NovaSonicVoiceOptions,
  NovaSonicVoiceOptions,
  ToolsInput,
  NovaSonicEventMap
> {
  private client?: BedrockRuntimeClient;
  private stream?: AsyncIterable<any>;
  private inputStream?: PassThrough; // Input stream for sending events to AWS
  private state: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private events: EventMap;
  private instructions?: string;
  private tools?: ToolsInput;
  private requestContext?: RequestContext;
  private debug: boolean;
  private region: NovaSonicRegion;
  private model: string;
  private credentials?: AwsCredentialIdentity;
  private speakerStreams: Map<string, StreamWithId>;
  private currentResponseId?: string;
  private processingStream = false;
  private streamRestartAttempted = false; // Prevent multiple restart attempts
  private sessionConfig?: ConfigType['sessionConfig'];
  private promptStarted = false; // Track if promptStart was sent (now sent during connection)
  private audioContentName?: string;
  private audioContentStarted = false;
  private hasSentContentEnd = false; // Track if contentEnd has been sent for current turn
  private turnCompleted = false; // Track if turn has been completed (to prevent sending contentEnd after turn completion)
  private turnCompleteTimeout?: NodeJS.Timeout; // Timeout for fallback turn completion
  private isReceivingAssistantAudio = false; // Track if we're currently receiving assistant audio output
  private currentTextGenerationStage?: string; // Track generationStage (SPECULATIVE|FINAL) for current text content block

  /**
   * Creates a new instance of NovaSonicVoice.
   *
   * @param config - Configuration options for the voice instance
   * @param config.region - AWS region (defaults to us-east-1)
   * @param config.model - The model ID to use (defaults to amazon.nova-2-sonic-v1:0)
   * @param config.credentials - AWS credentials (optional, uses default credential chain)
   * @param config.speaker - Voice name/identifier
   * @param config.languageCode - Language code for the voice
   * @param config.debug - Enable debug mode
   *
   * @example
   * ```typescript
   * const voice = new NovaSonicVoice({
   *   region: 'us-east-1',
   *   model: 'amazon.nova-2-sonic-v1:0',
   *   speaker: 'default',
   * });
   * ```
   */
  constructor(
    config: VoiceConfig<ConfigType> | ConfigType = {},
  ) {
    // Normalize config to VoiceConfig format
    let normalizedConfig: VoiceConfig<ConfigType>;
    if ('realtimeConfig' in config || 'speechModel' in config || 'listeningModel' in config) {
      normalizedConfig = config as VoiceConfig<ConfigType>;
    } else {
      const configOptions = config as ConfigType;
      normalizedConfig = {
        realtimeConfig: {
          model: configOptions.model || DEFAULT_MODEL,
          apiKey: undefined, // AWS doesn't use API keys
          options: configOptions,
        },
        speaker: typeof configOptions.speaker === 'string' ? configOptions.speaker : 'matthew',
      };
    }

    super(normalizedConfig);

    const options = normalizedConfig.realtimeConfig?.options || (config as ConfigType);
    this.region = (options.region as NovaSonicRegion) || DEFAULT_REGION;
    this.model = options.model || DEFAULT_MODEL;
    this.credentials = options.credentials;
    this.debug = options.debug || false;
    this.sessionConfig = options.sessionConfig;
    // Speaker is set by parent class constructor
    this.events = {} as EventMap;
    this.speakerStreams = new Map();

    // Validate region
    const validRegions: NovaSonicRegion[] = ['us-east-1', 'us-west-2', 'ap-northeast-1'];
    if (!validRegions.includes(this.region)) {
      throw new NovaSonicError(
        ErrorCode.REGION_INVALID,
        `Invalid region: ${this.region}. Supported regions: ${validRegions.join(', ')}`,
      );
    }
  }

  /**
   * Returns a list of available voice speakers.
   * 
   * Nova 2 Sonic provides expressive voices across multiple languages.
   * Tiffany (en-US, feminine) and Matthew (en-US, masculine) are polyglot
   * voices that can speak all supported languages.
   *
   * @returns Promise resolving to an array of voice objects
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; name: string; language: string; locale: string; gender: 'masculine' | 'feminine'; polyglot: boolean }>> {
    // Nova 2 Sonic available voices according to AWS documentation
    return Promise.resolve([
      // English (US) - Polyglot voices
      { voiceId: 'tiffany', name: 'Tiffany', language: 'English', locale: 'en-US', gender: 'feminine', polyglot: true },
      { voiceId: 'matthew', name: 'Matthew', language: 'English', locale: 'en-US', gender: 'masculine', polyglot: true },
      // English (UK)
      { voiceId: 'amy', name: 'Amy', language: 'English', locale: 'en-GB', gender: 'feminine', polyglot: false },
      // English (Australia)
      { voiceId: 'olivia', name: 'Olivia', language: 'English', locale: 'en-AU', gender: 'feminine', polyglot: false },
      // English (Indian)
      { voiceId: 'kiara', name: 'Kiara', language: 'English', locale: 'en-IN', gender: 'feminine', polyglot: false },
      { voiceId: 'arjun', name: 'Arjun', language: 'English', locale: 'en-IN', gender: 'masculine', polyglot: false },
      // French
      { voiceId: 'ambre', name: 'Ambre', language: 'French', locale: 'fr-FR', gender: 'feminine', polyglot: false },
      { voiceId: 'florian', name: 'Florian', language: 'French', locale: 'fr-FR', gender: 'masculine', polyglot: false },
      // Italian
      { voiceId: 'beatrice', name: 'Beatrice', language: 'Italian', locale: 'it-IT', gender: 'feminine', polyglot: false },
      { voiceId: 'lorenzo', name: 'Lorenzo', language: 'Italian', locale: 'it-IT', gender: 'masculine', polyglot: false },
      // German
      { voiceId: 'tina', name: 'Tina', language: 'German', locale: 'de-DE', gender: 'feminine', polyglot: false },
      { voiceId: 'lennart', name: 'Lennart', language: 'German', locale: 'de-DE', gender: 'masculine', polyglot: false },
      // Spanish (US)
      { voiceId: 'lupe', name: 'Lupe', language: 'Spanish', locale: 'es-US', gender: 'feminine', polyglot: false },
      { voiceId: 'carlos', name: 'Carlos', language: 'Spanish', locale: 'es-US', gender: 'masculine', polyglot: false },
      // Portuguese
      { voiceId: 'carolina', name: 'Carolina', language: 'Portuguese', locale: 'pt-BR', gender: 'feminine', polyglot: false },
      { voiceId: 'leo', name: 'Leo', language: 'Portuguese', locale: 'pt-BR', gender: 'masculine', polyglot: false },
      // Hindi
      { voiceId: 'kiara', name: 'Kiara', language: 'Hindi', locale: 'hi-IN', gender: 'feminine', polyglot: false },
      { voiceId: 'arjun', name: 'Arjun', language: 'Hindi', locale: 'hi-IN', gender: 'masculine', polyglot: false },
    ]);
  }

  /**
   * Establishes a connection to the AWS Bedrock bidirectional streaming service.
   * Must be called before using speak, listen, or send functions.
   *
   * @throws {NovaSonicError} If connection fails or credentials are missing
   *
   * @example
   * ```typescript
   * await voice.connect();
   * // Now ready for voice interactions
   * ```
   */
  async connect({ requestContext }: { requestContext?: RequestContext } = {}): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      this.log('Already connected or connecting');
      return;
    }

    this.state = 'connecting';
    this.requestContext = requestContext;

    try {
      this.log('Getting AWS credentials...');
      // Get AWS credentials
      const credentials = await getAwsCredentials(this.credentials);
      
      if (!credentials) {
        throw new NovaSonicError(
          ErrorCode.CREDENTIALS_MISSING,
          'AWS credentials are required. Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables or provide credentials in the config.',
        );
      }

      // Log credentials info (masked for security)
      this.log('Credentials retrieved:', {
        hasAccessKeyId: !!credentials.accessKeyId,
        hasSecretAccessKey: !!credentials.secretAccessKey,
        hasSessionToken: !!credentials.sessionToken,
        accessKeyIdPrefix: credentials.accessKeyId ? `${credentials.accessKeyId.substring(0, 6)}...` : 'missing',
        expiration: credentials.expiration ? credentials.expiration.toISOString() : 'no expiration',
      });

      this.log(`Initializing Bedrock Runtime client for region: ${this.region}, model: ${this.model}`);
      this.log(`[DEBUG] Client config:`, {
        region: this.region,
        model: this.model,
        hasCredentials: !!credentials,
        hasRequestHandler: true,
      });
      
      // Use NodeHttp2Handler for bidirectional streaming
      const nodeHttp2Handler = new NodeHttp2Handler({
        requestTimeout: 300000, // 5 minutes
        sessionTimeout: 300000, // 5 minutes
        disableConcurrentStreams: false,
        maxConcurrentStreams: 20,
      });
      
      // Initialize Bedrock Runtime client with HTTP/2 handler
      this.client = new BedrockRuntimeClient({
        region: this.region,
        credentials,
        requestHandler: nodeHttp2Handler,
      });

      this.log('Creating bidirectional stream command...');
      
      // Use a queue to store events and a signal to wake up the iterator
      // The iterator waits on the signal when queue is empty, allowing SDK to establish connection
      // Use array of resolve functions to handle multiple concurrent next() calls
      const voiceInstance = this;
      const eventQueue: Array<{ event: any }> = [];
      const pendingResolvers: Array<() => void> = [];
      let closeSignal = false;
      let streamError: Error | null = null;
      
      // Function to signal that data is available in the queue
      // Resolves all pending Promises (handles multiple concurrent next() calls)
      const signalQueue = () => {
        if (pendingResolvers.length > 0) {
          voiceInstance.log(`[AsyncIterable] Signaling queue - resolving ${pendingResolvers.length} pending Promise(s)`);
          const resolvers = [...pendingResolvers];
          pendingResolvers.length = 0; // Clear array
          resolvers.forEach(resolve => resolve());
        } else {
          voiceInstance.log('[AsyncIterable] signalQueue called but no pending Promise');
        }
      };
      
      // Create async iterable
      const asyncIterable = {
        [Symbol.asyncIterator]: () => {
          voiceInstance.log('[AsyncIterable] Iterator requested');
          
          return {
            next: async (): Promise<IteratorResult<any>> => {
              try {
                // Check if closed
                // Allow 'connecting' state since iterator is created during connection
                if (closeSignal || voiceInstance.state === 'disconnected') {
                  voiceInstance.log(`[AsyncIterable] Stream closed (state: ${voiceInstance.state}), done = true`);
                  return { value: undefined, done: true };
                }
                
                // Wait for items in the queue or close signal
                // CRITICAL: We must wait indefinitely when queue is empty, as long as connection is active
                // Only return done: true when explicitly closed or disconnected
                // This keeps the stream open for ongoing conversation
                if (eventQueue.length === 0) {
                  try {
                    voiceInstance.log('[AsyncIterable] Queue empty, waiting for signal...');
                    // Wait for signal that data is available or stream is closed
                    // This Promise stays pending until signalQueue() is called OR connection is closed
                    // We DON'T timeout here - we wait indefinitely for new events as long as connection is active
                    await new Promise<void>((resolve) => {
                      // Add to array of pending resolvers (handles multiple concurrent next() calls)
                      pendingResolvers.push(resolve);
                      voiceInstance.log(`[AsyncIterable] Promise created, waiting for signal (${pendingResolvers.length} pending)...`);
                      
                      // Double-check conditions after setting up the resolve
                      setImmediate(() => {
                        // If data arrived or connection closed, resolve immediately
                        if (eventQueue.length > 0) {
                          voiceInstance.log('[AsyncIterable] Data arrived before wait, resolving immediately');
                          const index = pendingResolvers.indexOf(resolve);
                          if (index !== -1) {
                            pendingResolvers.splice(index, 1);
                            resolve();
                          }
                          return;
                        }
                        if (closeSignal || voiceInstance.state === 'disconnected') {
                          voiceInstance.log('[AsyncIterable] Closed before wait, resolving');
                          const index = pendingResolvers.indexOf(resolve);
                          if (index !== -1) {
                            pendingResolvers.splice(index, 1);
                            resolve();
                          }
                          return;
                        }
                        // Otherwise, Promise stays pending until signalQueue() is called
                        // This allows SDK to establish connection while waiting
                        // We DON'T timeout here - we wait indefinitely for new events
                      });
                    });
                    voiceInstance.log('[AsyncIterable] Promise resolved, checking queue...');
                  } catch (error) {
                    if (error instanceof Error && error.message === 'Stream closed') {
                      voiceInstance.log('[AsyncIterable] Stream closed during wait');
                      return { value: undefined, done: true };
                    }
                    voiceInstance.log('[AsyncIterable] Error during wait:', error);
                  }
                }
                
                // Check if closed after waiting (state could have changed)
                if (closeSignal) {
                  voiceInstance.log('[AsyncIterable] Stream closed (closeSignal)');
                  return { value: undefined, done: true };
                }
                // Check state (use type assertion to avoid TypeScript narrowing issues)
                if ((voiceInstance.state as string) === 'disconnected') {
                  voiceInstance.log('[AsyncIterable] Stream closed (disconnected state)');
                  return { value: undefined, done: true };
                }
                
                // If queue is still empty after signal but connection is still active,
                // we should wait again (not return done: true)
                // This keeps the stream open for ongoing conversation
                // Loop back to wait again if queue is still empty
                while (eventQueue.length === 0 && !closeSignal) {
                  // Check state before waiting (use type assertion to avoid narrowing)
                  if ((voiceInstance.state as string) === 'disconnected') {
                    voiceInstance.log('[AsyncIterable] Stream closed before wait loop');
                    return { value: undefined, done: true };
                  }
                  
                  voiceInstance.log('[AsyncIterable] Queue still empty, waiting again...');
                  await new Promise<void>((resolve) => {
                    pendingResolvers.push(resolve);
                    setImmediate(() => {
                      // Check state (use type assertion to avoid narrowing)
                      if (eventQueue.length > 0 || closeSignal || (voiceInstance.state as string) === 'disconnected') {
                        const index = pendingResolvers.indexOf(resolve);
                        if (index !== -1) {
                          pendingResolvers.splice(index, 1);
                          resolve();
                        }
                      }
                    });
                  });
                  
                  // Check if closed after waiting (use type assertion to avoid narrowing)
                  if (closeSignal || (voiceInstance.state as string) === 'disconnected') {
                    voiceInstance.log('[AsyncIterable] Stream closed during wait loop');
                    return { value: undefined, done: true };
                  }
                }
                
                // Get next item from queue
                const nextEvent = eventQueue.shift()!;
                const eventJson = JSON.stringify(nextEvent);
                const eventBytes = Buffer.from(eventJson, 'utf-8');
                
                voiceInstance.log(`[AsyncIterable] Yielding event of size: ${eventBytes.length}`);
                return {
                  value: {
                    chunk: {
                      bytes: eventBytes
                    }
                  },
                  done: false
                };
              } catch (error) {
                voiceInstance.log('[AsyncIterable] Error in iterator:', error);
                closeSignal = true;
                return { value: undefined, done: true };
              }
            },
            
            return: async (): Promise<IteratorResult<any>> => {
              voiceInstance.log('[AsyncIterable] Iterator return() called');
              closeSignal = true;
              signalQueue();
              return { value: undefined, done: true };
            },
            
            throw: async (error: any): Promise<IteratorResult<any>> => {
              voiceInstance.log('[AsyncIterable] Iterator throw() called:', error);
              closeSignal = true;
              streamError = error instanceof Error ? error : new Error(String(error));
              signalQueue();
              throw error;
            }
          };
        }
      };
      
      // Store the queue and signal function for use in sendClientEvent
      (this as any)._eventQueue = eventQueue;
      (this as any)._signalQueue = signalQueue;
      (this as any)._closeSignal = () => { closeSignal = true; signalQueue(); };
      
      // CRITICAL: Pre-populate queue with sessionStart and promptStart events BEFORE calling send()
      // AWS requires both sessionStart and promptStart in the initial connection sequence
      // setupSessionAndPromptStart queues both events
      this.log('Pre-populating queue with sessionStart and promptStart events...');
      
      // Generate promptName for this session
      const promptName = randomUUID();
      (this as any)._promptName = promptName;
      
      // 1. Session start event
      // Build sessionStart event with all available parameters from sessionConfig
      const sessionStartEvent: any = {};
      
      if (this.sessionConfig) {
        // Extract inferenceConfiguration from sessionConfig
        if (this.sessionConfig.inferenceConfiguration) {
          sessionStartEvent.inferenceConfiguration = {
            maxTokens: this.sessionConfig.inferenceConfiguration.maxTokens || 4096,
            topP: this.sessionConfig.inferenceConfiguration.topP || 0.9,
            temperature: this.sessionConfig.inferenceConfiguration.temperature || 0.7,
            ...(this.sessionConfig.inferenceConfiguration.topK !== undefined && { topK: this.sessionConfig.inferenceConfiguration.topK }),
            ...(this.sessionConfig.inferenceConfiguration.stopSequences && { stopSequences: this.sessionConfig.inferenceConfiguration.stopSequences }),
          };
        } else {
          // Default inference configuration if not provided
          sessionStartEvent.inferenceConfiguration = {
            maxTokens: 4096,
            topP: 0.9,
            temperature: 0.7,
          };
        }
        
        // Extract turnDetectionConfiguration (Nova 2 Sonic uses this instead of turnTaking)
        if (this.sessionConfig.turnDetectionConfiguration) {
          sessionStartEvent.turnDetectionConfiguration = {
            ...(this.sessionConfig.turnDetectionConfiguration.endpointingSensitivity && { 
              endpointingSensitivity: this.sessionConfig.turnDetectionConfiguration.endpointingSensitivity 
            }),
          };
        }
        
        // Note: turnTaking is NOT supported in Nova 2 Sonic - only turnDetectionConfiguration is valid
        // Legacy turnTaking support removed for Nova 2 Sonic compatibility
      } else {
        // Default inference configuration if no sessionConfig provided
        sessionStartEvent.inferenceConfiguration = {
          maxTokens: 4096,
          topP: 0.9,
          temperature: 0.7,
        };
      }
      
      eventQueue.push({
        event: {
          sessionStart: sessionStartEvent,
        },
      });
      
      // 2. Prompt start event (required - AWS validates this during connection)
      // Determine voice ID - prioritize sessionConfig.voice, then this.speaker, then default to matthew
      let voiceId = 'matthew'; // Default polyglot voice
      if (this.sessionConfig?.voice) {
        if (typeof this.sessionConfig.voice === 'string') {
          voiceId = this.sessionConfig.voice;
        } else if (this.sessionConfig.voice.name) {
          voiceId = this.sessionConfig.voice.name;
        }
      } else if (this.speaker && this.speaker !== 'default') {
        if (typeof this.speaker === 'string') {
          voiceId = this.speaker;
        } else {
          // Type guard for object with name property
          const speakerObj = this.speaker as { name?: string };
          if (speakerObj && typeof speakerObj === 'object' && speakerObj.name) {
            voiceId = speakerObj.name;
          }
        }
      }
      
      // Build promptStart event with all available parameters
      // AWS REQUIRES audioOutputConfiguration to be set (it's mandatory)
      // However, when it's set, AWS expects audio input
      // For text-only input, we'll send an empty audio contentEnd to satisfy the requirement
      const promptStartEvent: any = {
        promptName,
        textOutputConfiguration: {
          mediaType: "text/plain",
        },
        // AWS REQUIRES this - cannot be omitted
        audioOutputConfiguration: {
          mediaType: "audio/lpcm",
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: voiceId,
          encoding: "base64",
          audioType: "SPEECH",
        },
      };
      
      // Add toolConfiguration if tools are configured
      // According to AWS Nova 2 Sonic docs, tools should be in toolConfiguration.tools[].toolSpec format
      if (this.sessionConfig?.tools && this.sessionConfig.tools.length > 0) {
        promptStartEvent.toolConfiguration = {
          tools: this.sessionConfig.tools.map(tool => {
            // inputSchema should be a JSON string according to Nova 2 Sonic documentation
            // If it's already a string, use it; otherwise stringify the object
            let inputSchemaJson: string;
            if (typeof tool.inputSchema === 'string') {
              inputSchemaJson = tool.inputSchema;
            } else {
              inputSchemaJson = JSON.stringify(tool.inputSchema);
            }
            
            return {
              toolSpec: {
                name: tool.name,
                description: tool.description,
                inputSchema: {
                  json: inputSchemaJson,
                },
              },
            };
          }),
          // toolChoice goes inside toolConfiguration for Nova 2 Sonic
          ...(this.sessionConfig?.toolChoice && { toolChoice: this.sessionConfig.toolChoice }),
        };
      } else if (this.sessionConfig?.toolChoice) {
        // If toolChoice is specified without tools, still include it in toolConfiguration
        promptStartEvent.toolConfiguration = {
          toolChoice: this.sessionConfig.toolChoice,
        };
      }
      
      // Note: knowledgeBaseConfig is not documented in Nova 2 Sonic promptStart event structure
      // If needed, it may be configured differently or may not be supported in the bidirectional streaming API
      // Commenting out for now to ensure compatibility
      // if (this.sessionConfig?.knowledgeBaseConfig) {
      //   promptStartEvent.knowledgeBaseConfig = {
      //     ...(this.sessionConfig.knowledgeBaseConfig.knowledgeBaseId && { 
      //       knowledgeBaseId: this.sessionConfig.knowledgeBaseConfig.knowledgeBaseId 
      //     }),
      //     ...(this.sessionConfig.knowledgeBaseConfig.dataSourceId && { 
      //       dataSourceId: this.sessionConfig.knowledgeBaseConfig.dataSourceId 
      //     }),
      //   };
      // }
      
      eventQueue.push({
        event: {
          promptStart: promptStartEvent,
        },
      });
      
      // Mark prompt as started since we've sent promptStart during connection
      this.promptStarted = true;
      
      // 3. System prompt events
      // AWS requires that the FIRST content after promptStart must have SYSTEM role
      // We always send a SYSTEM content, even if instructions are empty
      const systemContentName = randomUUID();
      // Content start
      eventQueue.push({
        event: {
          contentStart: {
            promptName,
            contentName: systemContentName,
            type: "TEXT",
            interactive: false,
            role: "SYSTEM",
            textInputConfiguration: {
              mediaType: "text/plain",
            },
          },
        },
      });
      // Text input (send instructions if provided, otherwise empty string)
      eventQueue.push({
        event: {
          textInput: {
            promptName,
            contentName: systemContentName,
            content: this.instructions || '',
          },
        },
      });
      // Content end
      eventQueue.push({
        event: {
          contentEnd: {
            promptName,
            contentName: systemContentName,
          },
        },
      });
      
      // 4. Do NOT send AUDIO contentStart during connection
      // AUDIO contentStart should only be sent when audio streaming actually starts (via send() method)
      // The audioContentName will be set when send() is first called
      // This prevents AWS from waiting for audio bytes during connection
      this.audioContentStarted = false;
      
      this.log(`Queue pre-populated with ${eventQueue.length} event(s)`);
      
      // According to AWS documentation, the chunk in the request body is OPTIONAL
      // However, AWS SDK v3 requires a body parameter
      // The async iterable above uses a queue-based approach that doesn't block
      // on an empty stream, allowing the connection to establish
      // According to AWS docs, body is optional for bidirectional streaming
      // But SDK requires it - we provide an async iterable that yields when data is available
      const command = new InvokeModelWithBidirectionalStreamCommand({
        modelId: this.model,
        body: asyncIterable as any, // Type assertion needed as SDK types may be strict
      });
      
      try {
        // The send() call should return immediately with the response stream
        // If it hangs, it means the async iterable is blocking
        const sendStartTime = Date.now();
        
        const response = await Promise.race([
          this.client.send(command),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              this.log('[DEBUG] client.send() timeout after 5 seconds - this indicates the SDK is waiting');
              reject(new Error('client.send() timeout'));
            }, 5000);
          }),
        ]).catch((error) => {
          const sendDuration = Date.now() - sendStartTime;
          this.log(`[DEBUG] client.send() error after ${sendDuration}ms:`, error);
          throw error;
        });
        
        const sendDuration = Date.now() - sendStartTime;
        this.log(`[DEBUG] client.send() completed in ${sendDuration}ms`);
        this.log('Received response from AWS Bedrock');
        
        // The response contains the stream itself
        this.stream = response.body;
        this.log(`[DEBUG] Response stream type: ${typeof this.stream}`);
        this.log(`[DEBUG] Response stream is async iterable: ${this.stream && typeof this.stream[Symbol.asyncIterator] === 'function'}`);
        this.state = 'connected';
        this.log(`[STATE] State set to 'connected' at line 566`);
      } catch (error) {
        this.log('Error during send():', error);
        this.log(`[DEBUG] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
        this.log(`[DEBUG] Error message: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          this.log(`[DEBUG] Error stack: ${error.stack}`);
        }
        throw error;
      }

      // Start processing the stream (fire and forget)
      this.processStream().catch((error) => {
        this.log('Error in stream processing:', error);
        this.emit('error', {
          message: error instanceof Error ? error.message : 'Stream processing error',
          code: 'STREAM_PROCESSING_ERROR',
          details: error,
        });
      });

      // Note: All initial events (sessionStart, promptStart, systemPrompt, audioStart) 
      // were already added to queue before send() was called
      // This ensures the SDK can establish the connection immediately and AWS is ready
      // for audio input right away, reducing initial latency
      this.log('Connected to AWS Bedrock Nova 2 Sonic');
    } catch (error) {
      this.state = 'disconnected';
      this.log('Connection error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during connection';
      throw new NovaSonicError(
        ErrorCode.CONNECTION_FAILED,
        `Failed to connect to AWS Bedrock: ${errorMessage}`,
        error,
      );
    }
  }

  /**
   * Process the bidirectional stream from AWS Bedrock
   */
  private async processStream(): Promise<void> {
    if (!this.stream) {
      this.log('[Stream] No stream available, cannot process');
      return;
    }
    
    // Allow re-processing if stream is still active but processingStream was reset
    // This handles the case where the stream continues but processingStream was set to false
    if (this.processingStream) {
      this.log('[Stream] Already processing stream, skipping');
      return;
    }

    this.processingStream = true;
    this.log('[Stream] Starting stream processing');

    let eventCount = 0;
    let lastEventTime = Date.now();
    
    try {
      for await (const chunk of this.stream) {
        if (chunk.chunk) {
          // Parse the chunk bytes
          const textResponse = Buffer.from(chunk.chunk.bytes || []).toString('utf-8');
          eventCount++;
          const now = Date.now();
          const timeSinceLastEvent = now - lastEventTime;
          lastEventTime = now;
          this.log(`[Stream] Received chunk #${eventCount}, length: ${textResponse.length}, time since last: ${timeSinceLastEvent}ms, preview: ${textResponse.substring(0, 200)}`);
          
          try {
            const jsonResponse = JSON.parse(textResponse);
            this.log(`[Stream] ========================================`);
            this.log(`[Stream] Parsed JSON response, keys: ${Object.keys(jsonResponse).join(', ')}`);
            this.log(`[Stream] Full response (first 500 chars): ${JSON.stringify(jsonResponse).substring(0, 500)}`);
            
            // AWS wraps most events in an 'event' property
            // Structure: { event: { textOutput: ..., audioOutput: ..., etc } }
            // But some events like usageEvent might be at top level
            // Following AWS sample pattern exactly
            if (jsonResponse.event) {
              const eventData = jsonResponse.event as NovaSonicServerEvent;
              const eventKeys = Object.keys(jsonResponse.event);
              this.log(`[Stream] Event keys: ${eventKeys.join(', ')}`);
              
              // Handle events in the same order as AWS sample
              if (jsonResponse.event.contentStart) {
                this.log(`[Stream] → Handling contentStart`);
                this.handleServerEvent({ contentStart: jsonResponse.event.contentStart } as NovaSonicServerEvent);
              } else if (jsonResponse.event.textOutput) {
                this.log(`[Stream] → Handling textOutput: ${JSON.stringify(jsonResponse.event.textOutput).substring(0, 200)}`);
                this.handleServerEvent({ textOutput: jsonResponse.event.textOutput } as NovaSonicServerEvent);
              } else if (jsonResponse.event.audioOutput) {
                this.handleServerEvent({ audioOutput: jsonResponse.event.audioOutput } as NovaSonicServerEvent);
              } else if (jsonResponse.event.toolUse) {
                this.handleServerEvent({ toolUse: jsonResponse.event.toolUse } as NovaSonicServerEvent);
              } else if (jsonResponse.event.contentEnd && jsonResponse.event.contentEnd.type === 'TOOL') {
                this.handleServerEvent({ contentEnd: jsonResponse.event.contentEnd } as NovaSonicServerEvent);
              } else if (jsonResponse.event.contentEnd) {
                this.log(`[Stream] Found contentEnd, type: ${jsonResponse.event.contentEnd.type}, stopReason: ${jsonResponse.event.contentEnd.stopReason}`);
                this.handleServerEvent({ contentEnd: jsonResponse.event.contentEnd } as NovaSonicServerEvent);
              } else if (jsonResponse.event.completionStart) {
                // Handle completionStart inside event object
                // According to AWS docs: completionStart signals the start of a response
                this.log('[Stream] Found completionStart inside event object:', JSON.stringify(jsonResponse.event.completionStart, null, 2));
                this.emit('completionStart', jsonResponse.event.completionStart);
              } else if (jsonResponse.event.completionEnd) {
                // Handle completionEnd inside event object
                // According to AWS docs: completionEnd with stopReason "END_TURN" signals turn completion
                this.log('[Stream] Found completionEnd inside event object:', JSON.stringify(jsonResponse.event.completionEnd, null, 2));
                this.handleServerEvent({ completionEnd: jsonResponse.event.completionEnd } as NovaSonicServerEvent);
              } else {
                // Handle other events - dispatch the first event key found (AWS sample pattern)
                const eventKeys = Object.keys(jsonResponse.event || {});
                this.log(`[Stream] Event keys for other events: ${eventKeys.join(', ')}`);
                if (eventKeys.length > 0) {
                  // Check if completionEnd is in the event keys
                  if (eventKeys.includes('completionEnd')) {
                    this.log('[Stream] Found completionEnd in other events, handling explicitly');
                    this.handleServerEvent({ completionEnd: jsonResponse.event.completionEnd } as NovaSonicServerEvent);
                  } else {
                    // Dispatch the event using the first key
                    const eventKey = eventKeys[0] as keyof NovaSonicServerEvent;
                    this.log(`[Stream] Dispatching other event: ${eventKey}`);
                    const eventValue = jsonResponse.event[eventKey];
                    if (eventValue !== undefined) {
                      // Check if it's completionEnd before dispatching
                      if (eventKey === 'completionEnd') {
                        this.handleServerEvent({ completionEnd: eventValue } as NovaSonicServerEvent);
                      } else {
                        this.handleServerEvent({ [eventKey]: eventValue } as NovaSonicServerEvent);
                      }
                    }
                  }
                } else if (Object.keys(jsonResponse).length > 0) {
                  this.log(`[Stream] Unknown event structure:`, JSON.stringify(jsonResponse, null, 2));
                }
              }
            } else {
              // Handle events that might be at top level (usageEvent, completionEnd, etc.)
              if (this.debug) {
                this.log('[Stream] Received event without "event" wrapper:', JSON.stringify(jsonResponse, null, 2));
              }
              
              // Check if it's a usageEvent
              if (jsonResponse.usageEvent) {
                // Emit usage event
                this.emit('usage', {
                  inputTokens: jsonResponse.usageEvent.totalInputTokens || 0,
                  outputTokens: jsonResponse.usageEvent.totalOutputTokens || 0,
                  totalTokens: jsonResponse.usageEvent.totalTokens || 0,
                });
              }
              
              // Check if it's a completionEnd at top level
              if (jsonResponse.completionEnd) {
                this.log('[Stream] Found completionEnd at top level:', JSON.stringify(jsonResponse.completionEnd, null, 2));
                this.handleServerEvent({ completionEnd: jsonResponse.completionEnd } as NovaSonicServerEvent);
              }
              
              // Also check if completionEnd might be directly in jsonResponse (not wrapped)
              if (!jsonResponse.event && !jsonResponse.completionEnd && !jsonResponse.usageEvent) {
                // Log the entire response to see what we're missing
                this.log('[Stream] Received response without event wrapper, full structure:', JSON.stringify(jsonResponse, null, 2));
              }
              
              // Check if it's a completionStart at top level or in event
              if (jsonResponse.completionStart || jsonResponse.event?.completionStart) {
                const completionStart = jsonResponse.completionStart || jsonResponse.event.completionStart;
                this.log('[Stream] Found completionStart:', JSON.stringify(completionStart, null, 2));
                // Track that we've started a completion - we should expect completionEnd
                this.emit('completionStart', completionStart);
              }
            }
          } catch (parseError) {
            this.log('[Stream] Failed to parse JSON response:', textResponse.substring(0, 200));
            this.emit('error', {
              message: 'Failed to parse stream response',
              code: 'PARSE_ERROR',
              details: parseError,
            });
          }
        } else if (chunk.internalServerException) {
          this.emit('error', {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            details: chunk.internalServerException,
          });
        } else if (chunk.modelStreamErrorException) {
          this.emit('error', {
            message: 'Model stream error',
            code: 'MODEL_STREAM_ERROR',
            details: chunk.modelStreamErrorException,
          });
        } else if (chunk.modelTimeoutException) {
          this.emit('error', {
            message: 'Model timeout',
            code: 'MODEL_TIMEOUT',
            details: chunk.modelTimeoutException,
          });
        } else if (chunk.serviceUnavailableException) {
          this.emit('error', {
            message: 'Service unavailable',
            code: 'SERVICE_UNAVAILABLE',
            details: chunk.serviceUnavailableException,
          });
        } else if (chunk.throttlingException) {
          this.emit('error', {
            message: 'Request throttled',
            code: 'THROTTLING',
            details: chunk.throttlingException,
          });
        } else if (chunk.validationException) {
          this.emit('error', {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: chunk.validationException,
          });
        }
      }
    } catch (streamError) {
      this.log('[Stream] Error in processStream:', streamError);
      this.emit('error', {
        message: 'Stream processing error',
        code: 'STREAM_ERROR',
        details: streamError instanceof Error ? streamError.message : String(streamError),
      });
      // Don't set processingStream = false here - let it be reset in finally
      // This allows the stream to potentially recover
    } finally {
      // The for await loop exits when the stream ends (no more chunks)
      // This is normal - the stream should stay open for the entire session
      // But if the loop exits, it means AWS closed the stream or stopped sending chunks
      this.processingStream = false;
      this.log(`[Stream] processStream finished, processingStream set to false. Total events received: ${eventCount || 0}`);
      this.log(`[Stream] Stream state: state=${this.state}, stream exists=${!!this.stream}`);
      
      // CRITICAL: If the stream ends without receiving completionEnd, we need to signal turn completion
      // This handles the case where AWS closes the stream after sending all audio but before sending completionEnd
      // According to AWS docs, completionEnd should always be sent, but if the stream closes, we should still signal completion
      // CRITICAL: Only emit turnComplete if we haven't already emitted it
      // This prevents duplicate emissions when the stream restarts
      if (!this.turnCompleted && this.audioContentStarted) {
        this.log('[Stream] Stream ended but turn not completed - signaling turn completion as fallback');
        this.log(`[Stream] State: turnCompleted=${this.turnCompleted}, audioContentStarted=${this.audioContentStarted}, hasSentContentEnd=${this.hasSentContentEnd}`);
        this.turnCompleted = true;
        this.emit('turnComplete', { timestamp: Date.now() });
        
        if (this.currentResponseId) {
          const stream = this.speakerStreams.get(this.currentResponseId);
          if (stream) {
            stream.end();
          }
          this.speakerStreams.delete(this.currentResponseId);
          this.currentResponseId = undefined;
        }
        
        this.hasSentContentEnd = false;
        this.log('[Stream] Turn completion signaled, ready for next turn');
      } else if (this.turnCompleted) {
        this.log('[Stream] Stream ended and turn was already completed');
      } else {
        this.log(`[Stream] Stream ended but turn not completed - audioContentStarted=${this.audioContentStarted}, turnCompleted=${this.turnCompleted}`);
      }
      
      // CRITICAL: If the stream is still open (state is connected), we should restart processing
      // The for await loop exits when no more chunks are available, but the stream might still be open
      // We need to restart processing to handle subsequent turns
      // BUT: Only restart once per stream end, and only if we haven't already attempted a restart
      if (this.stream && this.state === 'connected' && !this.processingStream && !this.streamRestartAttempted) {
        this.log('[Stream] Stream still open but processing stopped - will restart stream processing');
        this.streamRestartAttempted = true; // Mark that we've attempted a restart
        // Restart processing in the next tick to avoid blocking
        setImmediate(() => {
          if (this.stream && this.state === 'connected' && !this.processingStream) {
            this.log('[Stream] Restarting stream processing for subsequent turns');
            this.processStream().catch((error) => {
              this.log('[Stream] Error restarting stream processing:', error);
              this.streamRestartAttempted = false; // Reset on error to allow retry
            });
          } else {
            this.streamRestartAttempted = false; // Reset if conditions changed
          }
        });
      } else {
        if (this.streamRestartAttempted) {
          this.log('[Stream] Stream restart already attempted, skipping');
        }
      }
    }
  }

  /**
   * Handle server events from AWS Bedrock
   */
  private handleServerEvent(event: NovaSonicServerEvent): void {
    if (this.debug) {
      this.log('Received event:', JSON.stringify(event, null, 2));
    }

    // Handle content start
    // According to AWS docs: contentStart defines content type and format
    // It appears before each content block (ASR, tool use, text, audio)
    if (event.contentStart) {
      const role = event.contentStart.role?.toLowerCase() as 'assistant' | 'user' | undefined;
      // Type may not be in the type definition but exists in actual AWS responses
      const contentType = (event.contentStart as any).type;
      
      this.log(`[Event] contentStart: type=${contentType || 'unknown'}, role=${role}`);
      
      // Emit contentStart event for clients
      this.emit('contentStart', event.contentStart);
      
      // Track generationStage for the current text content block.
      // Nova Sonic sends SPECULATIVE (preview) then FINAL (actual transcript) for assistant text,
      // and FINAL for user ASR. This stage is included in 'writing' events so the client can
      // distinguish them and avoid showing duplicate bubbles.
      if (contentType === 'TEXT' && event.contentStart.additionalModelFields) {
        try {
          const additionalFields = JSON.parse(event.contentStart.additionalModelFields);
          this.currentTextGenerationStage = additionalFields.generationStage;
          this.log(`[Event] Text content generationStage: ${this.currentTextGenerationStage}`);
        } catch {
          this.currentTextGenerationStage = undefined;
        }
      } else if (contentType === 'TEXT') {
        this.currentTextGenerationStage = undefined;
      }
    }

    // Handle text output
    if (event.textOutput) {
      this.log(`[Event] ========================================`);
      this.log(`[Event] ✓✓✓ textOutput event received!`);
      this.log(`[Event] textOutput object: ${JSON.stringify(event.textOutput).substring(0, 300)}`);
      
      const text = event.textOutput.content || '';
      const role = (event.textOutput.role?.toLowerCase() as 'assistant' | 'user') || 'assistant';

      this.log(`[Event] Text output: role=${role}, text length=${text.length}, text preview: ${text.substring(0, 100)}`);

      // Check for barge-in (interruption)
      if (text.includes('{ "interrupted" : true }')) {
        this.log(`[Event] Interrupt detected, emitting interrupt event`);
        this.emit('interrupt', { type: 'user', timestamp: Date.now() });
      } else {
        // Emit immediately to reduce latency.
        // Include generationStage so the client can handle SPECULATIVE vs FINAL:
        // - SPECULATIVE = preview of planned speech (arrives first)
        // - FINAL = transcript of what was actually spoken (arrives after audio)
        const listenerCount = this.events['writing']?.length ?? 0;
        const generationStage = this.currentTextGenerationStage;
        this.log(`[Event] ✓✓✓ Emitting 'writing' event: role=${role}, generationStage=${generationStage}, text length=${text.length}, listeners=${listenerCount}`);
        this.emit('writing', { text, role, generationStage });
        this.log(`[Event] ✓✓✓ 'writing' event emitted, listeners count: ${this.events['writing']?.length ?? 0}`);
        this.log(`[Event] ========================================`);
      }
    }

    // Handle audio output
    if (event.audioOutput?.content) {
      try {
        const audioBytes = Buffer.from(event.audioOutput.content, 'base64');
        
        this.log(`[Event] Audio output: ${audioBytes.length} bytes`);
        
        // Mark that we're receiving assistant audio output
        this.isReceivingAssistantAudio = true;
        
        // Emit immediately to reduce latency
        this.emit('speaking', { 
          audio: event.audioOutput.content, // Base64 string (for SSE/JSON)
          audioData: audioBytes, // Buffer (for compatibility)
          response_id: this.currentResponseId 
        });

        // Also emit to speaker stream
        if (this.currentResponseId) {
          const stream = this.speakerStreams.get(this.currentResponseId);
          if (stream) {
            stream.write(audioBytes);
          }
        }
      } catch (error) {
        this.log('[Event] Error decoding audio:', error);
        this.emit('error', {
          message: 'Failed to decode audio',
          code: 'AUDIO_DECODE_ERROR',
          details: error,
        });
      }
    }

    // Handle tool use
    if (event.toolUse) {
      const toolUseId = event.toolUse.toolUseId || '';
      const toolName = event.toolUse.toolName || '';
      const toolInput = event.toolUse.input || {};

      this.emit('toolCall', {
        name: toolName,
        args: toolInput,
        id: toolUseId,
      });

      // Execute tool if available
      if (this.tools && toolName in this.tools) {
        this.handleToolCall(toolName, toolInput, toolUseId);
      }
    }

    // Handle content end
    // Following AWS sample: forward contentEnd events directly to clients
    if (event.contentEnd) {
      this.log(`[Event] contentEnd received: type=${event.contentEnd.type}, stopReason=${event.contentEnd.stopReason}`);
      
      // Emit contentEnd event (AWS sample forwards this directly to clients)
      this.emit('contentEnd', event.contentEnd);
      
      // Check for interruption (barge-in) - stopReason can be in contentEnd
      if (event.contentEnd.stopReason === 'INTERRUPTED') {
        this.log('[Event] Content interrupted by user (barge-in)');
        this.emit('interrupt', { type: 'user', timestamp: Date.now() });
        
        // Clear audio playback buffer immediately
        if (this.currentResponseId) {
          const stream = this.speakerStreams.get(this.currentResponseId);
          if (stream) {
            stream.destroy(); // Destroy instead of end to immediately stop
          }
          this.speakerStreams.delete(this.currentResponseId);
        }
        this.currentResponseId = undefined;
        
        // Following AWS sample: even after interruption, we keep audioContentStarted=true
        // and reuse the same audioContentName. We just continue with audioInput chunks.
        this.log('[Event] After interruption, keeping audioContentStarted=true for continued streaming');
        // DO NOT reset audioContentName - it persists for the entire session
      } else if (event.contentEnd.type === 'TOOL' && this.currentResponseId) {
        // Tool execution completed
        const stream = this.speakerStreams.get(this.currentResponseId);
        if (stream) {
          stream.end();
        }
      } else if (event.contentEnd.type === 'AUDIO') {
        // Audio content ended - this could be user input ending OR assistant output ending
        // According to AWS documentation:
        // - contentEnd (AUDIO) with stopReason "PARTIAL_TURN" or "END_TURN" marks end of audio content
        // - completionEnd with stopReason "END_TURN" signals turn completion
        // However, AWS may not always send completionEnd, so we need a fallback
        // If we receive contentEnd (AUDIO) with END_TURN for assistant output, we should signal turn complete
        // But we'll wait a bit to see if more audio chunks arrive
        if (event.contentEnd.stopReason === 'END_TURN') {
          // This is assistant audio output ending with END_TURN
          // According to AWS docs: contentEnd (AUDIO) with END_TURN marks end of audio content
          // completionEnd should follow, but if it doesn't, we should still signal turn completion
          // We'll emit turnComplete immediately, but also wait for completionEnd as the definitive signal
          this.log(`[Event] contentEnd (AUDIO) with stopReason END_TURN - signaling turn complete`);
          
          // End the audio stream
          if (this.currentResponseId) {
            const stream = this.speakerStreams.get(this.currentResponseId);
            if (stream) {
              stream.end();
            }
            this.speakerStreams.delete(this.currentResponseId);
            this.currentResponseId = undefined;
          }
          
          // Emit turnComplete immediately (frontend is already handling contentEnd with END_TURN)
          // But also set a flag to check if completionEnd arrives (which would be the definitive signal)
          // CRITICAL: Only emit once - check turnCompleted flag to prevent duplicate emissions
          if (!this.turnCompleted) {
            this.turnCompleted = true;
            this.emit('turnComplete', { timestamp: Date.now() });
            this.hasSentContentEnd = false;
            this.log(`[Event] Turn complete (from contentEnd AUDIO with END_TURN), ready for next turn. audioContentStarted: ${this.audioContentStarted}, audioContentName: ${this.audioContentName}`);
          } else {
            this.log(`[Event] contentEnd (AUDIO) with END_TURN received but turn already completed - skipping duplicate turnComplete emission`);
          }
          
          // Set a timeout to clear any pending state if completionEnd doesn't arrive
          // This is just for cleanup, not for signaling (we already signaled above)
          if (!this.turnCompleteTimeout) {
            this.turnCompleteTimeout = setTimeout(() => {
              // If completionEnd hasn't arrived, that's okay - we already signaled turn completion
              this.log(`[Event] Timeout: completionEnd not received, but turn already completed from contentEnd`);
              this.turnCompleteTimeout = undefined;
            }, 1000); // Short timeout just for logging
          }
        } else {
          // This is user audio input ending (stopReason might be undefined or PARTIAL_TURN)
          // OR assistant audio output ending with PARTIAL_TURN
          // Following AWS sample: contentStart (AUDIO) is sent ONCE at the beginning
          // and NEVER reset. We just continue sending audioInput chunks for subsequent turns.
          // DO NOT reset audioContentStarted - it stays true for the entire session
          // DO NOT reset audioContentName - it persists for the entire session
          
          // If this is assistant audio output ending (we were receiving assistant audio), 
          // and stopReason is PARTIAL_TURN, we should wait for completionEnd
          // But if completionEnd doesn't arrive, we'll use a fallback timeout
          if (this.isReceivingAssistantAudio && event.contentEnd.stopReason === 'PARTIAL_TURN') {
            // This is assistant output ending - wait for completionEnd
            // Set a fallback timeout to emit turnComplete if completionEnd doesn't arrive
            this.isReceivingAssistantAudio = false; // Reset flag
            if (!this.turnCompleteTimeout && !this.turnCompleted) {
              this.log(`[Event] contentEnd (AUDIO) with PARTIAL_TURN for assistant output - waiting for completionEnd, setting fallback timeout`);
              this.turnCompleteTimeout = setTimeout(() => {
                if (!this.turnCompleted) {
                  this.log(`[Event] Fallback: completionEnd not received after contentEnd (AUDIO) with PARTIAL_TURN, signaling turn complete`);
                  this.turnCompleted = true;
                  this.emit('turnComplete', { timestamp: Date.now() });
                  
                  if (this.currentResponseId) {
                    const stream = this.speakerStreams.get(this.currentResponseId);
                    if (stream) {
                      stream.end();
                    }
                    this.speakerStreams.delete(this.currentResponseId);
                    this.currentResponseId = undefined;
                  }
                  
                  this.hasSentContentEnd = false;
                  this.turnCompleteTimeout = undefined;
                }
              }, 2000); // 2 second timeout (reduced from 3)
            }
          } else {
            // This is user audio input ending
            // Reset hasSentContentEnd flag to allow sending contentEnd for the next turn
            // Also reset turnCompleted flag to allow new user input
            this.hasSentContentEnd = false;
            this.turnCompleted = false; // Reset for next turn
            this.log(`[Event] contentEnd (AUDIO) - user input ended, stopReason: ${event.contentEnd.stopReason}. Keeping audioContentStarted=true for next turn. Reset hasSentContentEnd=false, turnCompleted=false.`);
          }
        }
      } else if (event.contentEnd.type === 'TEXT') {
        // Text content ended — clear generationStage tracking
        this.currentTextGenerationStage = undefined;
        // IMPORTANT: Do NOT emit turnComplete here. Nova Sonic sends one contentEnd(TEXT) per
        // text content block, so emitting turnComplete here would fire multiple times per turn.
        // The definitive turn-completion signal comes from completionEnd (line ~1278) or
        // contentEnd(AUDIO, END_TURN) (line ~1171), both of which have proper guards.
        this.log(`[Event] contentEnd (TEXT) received, stopReason: ${event.contentEnd.stopReason}. Turn completion handled by completionEnd/contentEnd(AUDIO).`);
        if (event.contentEnd.stopReason === 'END_TURN') {
          this.hasSentContentEnd = false;
        }
      }
    }

    // Handle completion end
    // According to AWS documentation: completionEnd with stopReason "END_TURN" signals turn completion
    // This is the definitive signal that a turn is complete, not contentEnd
    if (event.completionEnd) {
      this.log(`[Event] completionEnd received, stopReason: ${event.completionEnd.stopReason}`);
      
      // Clear the fallback timeout if it was set
      if (this.turnCompleteTimeout) {
        clearTimeout(this.turnCompleteTimeout);
        this.turnCompleteTimeout = undefined;
      }
      
      // CRITICAL: End the audio stream BEFORE emitting turnComplete
      // This ensures all audio chunks have been received before we signal turn completion
      // completionEnd is the definitive signal that all audio has been sent
      if (this.currentResponseId) {
        const stream = this.speakerStreams.get(this.currentResponseId);
        if (stream) {
          stream.end();
        }
        this.speakerStreams.delete(this.currentResponseId);
        this.currentResponseId = undefined;
      }
      
      // Reset assistant audio flag
      this.isReceivingAssistantAudio = false;
      
      // Emit turnComplete for ANY completionEnd (AWS should send END_TURN, but be lenient)
      // This ensures the frontend resets even if AWS sends a different stopReason
      // CRITICAL: Only emit once - check turnCompleted flag to prevent duplicate emissions
      if (!this.turnCompleted) {
        this.log(`[Event] completionEnd - signaling turn complete (stopReason: ${event.completionEnd.stopReason || 'undefined'})`);
        this.turnCompleted = true; // Mark turn as completed
        this.emit('turnComplete', { timestamp: Date.now() });
        this.hasSentContentEnd = false;
        this.log(`[Event] Turn complete (from completionEnd), ready for next turn. audioContentStarted: ${this.audioContentStarted}, audioContentName: ${this.audioContentName}, reset hasSentContentEnd=false`);
      } else {
        this.log(`[Event] completionEnd received but turn already completed - skipping duplicate turnComplete emission`);
      }

      // Emit usage if available
      if (event.completionEnd.usage) {
        this.emit('usage', {
          inputTokens: event.completionEnd.usage.inputTokens || 0,
          outputTokens: event.completionEnd.usage.outputTokens || 0,
          totalTokens:
            (event.completionEnd.usage.inputTokens || 0) +
            (event.completionEnd.usage.outputTokens || 0),
        });
      }
    }

    // Handle errors
    if (event.error) {
      this.emit('error', {
        message: event.error.message || 'Unknown error',
        code: event.error.code || 'UNKNOWN_ERROR',
        details: event.error,
      });
    }
  }
  

  /**
   * Handle tool execution
   */
  private async handleToolCall(toolName: string, args: Record<string, any>, toolUseId: string): Promise<void> {
    const tool = this.tools?.[toolName];
    if (!tool || !tool.execute) {
      this.emit('error', {
        message: `Tool ${toolName} not found or has no execute function`,
        code: 'TOOL_NOT_FOUND',
      });
      return;
    }

    try {
      // Execute tool
      const result = await tool.execute(
        { context: args, requestContext: this.requestContext },
        {
          toolCallId: toolUseId,
          messages: [],
        },
      );

      // Send tool result back to the model
      await this.sendClientEvent({
        toolResult: {
          toolUseId,
          content: [
            {
              json: typeof result === 'object' ? result : { result },
            },
          ],
        },
      });
    } catch (error) {
      this.emit('error', {
        message: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'TOOL_EXECUTION_ERROR',
        details: error,
      });

      // Send error result back
      await this.sendClientEvent({
        toolResult: {
          toolUseId,
          content: [
            {
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        },
      });
    }
  }

  /**
   * Send a client event to AWS Bedrock
   * Events are sent through the input stream that was passed to the bidirectional stream command
   */
  private async sendClientEvent(event: NovaSonicClientEvent): Promise<void> {
    if (this.state !== 'connected') {
      throw new NovaSonicError(
        ErrorCode.NOT_CONNECTED,
        'Not connected to AWS Bedrock. Call connect() first.',
      );
    }

    try {
      // Add event to queue and signal (following AWS sample pattern)
      const eventQueue = (this as any)._eventQueue as Array<{ event: any }> | undefined;
      const signalQueue = (this as any)._signalQueue as (() => void) | undefined;
      
      if (!eventQueue || !signalQueue) {
        throw new NovaSonicError(
          ErrorCode.NOT_CONNECTED,
          'Event queue not initialized. Connection may not be fully established.',
        );
      }
      
      this.log(`[sendClientEvent] Adding event to queue (queue size: ${eventQueue.length})`);
      eventQueue.push({ event });
      this.log(`[sendClientEvent] Event added, queue size now: ${eventQueue.length}, signaling...`);
      signalQueue(); // Signal that data is available
      this.log(`[sendClientEvent] Signal sent`);
      
      if (this.debug) {
        this.log('Sent client event:', JSON.stringify(event, null, 2));
      }
    } catch (error) {
      throw new NovaSonicError(
        ErrorCode.WEBSOCKET_ERROR,
        `Failed to send client event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Disconnects from the AWS Bedrock session and cleans up resources.
   */
  close(): void {
    if (this.state === 'disconnected') {
      return;
    }

    this.state = 'disconnected';
    this.processingStream = false;

    // Signal close to the async iterable
    const closeSignal = (this as any)._closeSignal as (() => void) | undefined;
    if (closeSignal) {
      closeSignal();
    }

    // Close input stream if it exists
    if (this.inputStream) {
      this.inputStream.end();
      this.inputStream = undefined;
    }

    // End all speaker streams
    for (const stream of this.speakerStreams.values()) {
      stream.end();
    }
    this.speakerStreams.clear();

    this.log('Disconnected from AWS Bedrock Nova 2 Sonic');
  }

  /**
   * Equips the voice instance with a set of instructions.
   */
  addInstructions(instructions?: string): void {
    this.instructions = instructions;
  }

  /**
   * Equips the voice instance with a set of tools.
   */
  addTools(tools?: ToolsInput): void {
    this.tools = tools || {};
  }

  /**
   * Convert text to speech
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: string } & NovaSonicVoiceOptions,
  ): Promise<void> {
    if (this.state !== 'connected') {
      throw new NovaSonicError(
        ErrorCode.NOT_CONNECTED,
        'Not connected. Call connect() first.',
      );
    }

    // Convert stream to string if needed
    let text = '';
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      text = Buffer.concat(chunks).toString('utf-8');
    } else {
      text = input;
    }

    if (text.trim().length === 0) {
      throw new NovaSonicError(ErrorCode.VALIDATION_ERROR, 'Input text is empty');
    }

    // Generate a response ID for this turn
    this.currentResponseId = `response-${Date.now()}`;
    const speakerStream = new PassThrough() as StreamWithId;
    speakerStream.id = this.currentResponseId;
    this.speakerStreams.set(this.currentResponseId, speakerStream);
    this.emit('speaker', speakerStream);

    // Send text input event
    // Note: textInput in speak() is a simplified version for backward compatibility
    // For full control, use send() with proper contentStart/textInput/contentEnd sequence
    const promptName = (this as any)._promptName as string;
    if (!promptName) {
      throw new NovaSonicError(
        ErrorCode.NOT_CONNECTED,
        'Prompt name not initialized. Connection may not be fully established.',
      );
    }

    // Prompt should already be started during connection
    // Do NOT call startPrompt() here as it would send a duplicate promptStart
    // and AWS requires the first content after promptStart to be SYSTEM role
    if (!this.promptStarted) {
      throw new NovaSonicError(
        ErrorCode.INVALID_STATE,
        'Prompt not started. This should not happen - prompt should be started during connection.',
      );
    }

    const contentName = randomUUID();
    // Content start
    await this.sendClientEvent({
      contentStart: {
        promptName,
        contentName,
        type: "TEXT",
        interactive: true,
        role: "USER",
        textInputConfiguration: {
          mediaType: "text/plain",
        },
      },
    });
    // Text input
    await this.sendClientEvent({
      textInput: {
        promptName,
        contentName,
        content: text,
      },
    });
    // Content end
    await this.sendClientEvent({
      contentEnd: {
        promptName,
        contentName,
      },
    });
  }

  /**
   * Convert speech to text (transcription)
   * For Nova Sonic, this is the same as send() - both stream audio input
   */
  async listen(
    audioStream: NodeJS.ReadableStream | unknown,
    options?: NovaSonicVoiceOptions,
  ): Promise<void> {
    // For Nova Sonic, listen() and send() are the same - both stream audio
    // Convert to Int16Array or ReadableStream format expected by send()
    if (audioStream && typeof audioStream === 'object' && 'read' in audioStream) {
      await this.send(audioStream as NodeJS.ReadableStream);
    } else {
      throw new NovaSonicError(
        ErrorCode.INVALID_AUDIO_FORMAT,
        'Unsupported audio stream format for listen()',
      );
    }
  }

  /**
   * Streams audio data in real-time to the AWS Bedrock service.
   * Following AWS Nova 2 Sonic event sequence:
   * 1. contentStart (AUDIO, USER) - if not already sent
   * 2. audioInput events (one per chunk)
   * 3. contentEnd - when audio stream ends (handled separately via endAudioInput)
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    this.log(`[send] Current state: ${this.state}`);
    if (this.state !== 'connected') {
      this.log(`[send] ERROR: State is '${this.state}', expected 'connected'`);
      throw new NovaSonicError(
        ErrorCode.NOT_CONNECTED,
        `Not connected. Current state: ${this.state}. Call connect() first.`,
      );
    }
    this.log(`[send] State check passed, proceeding with send`);

    // Reset turnCompleted flag when user starts speaking again (new turn)
    // According to AWS sample: contentStart (AUDIO) is sent ONCE at the beginning and the same
    // audioContentId is reused for ALL turns. We do NOT send a new contentStart after turn completion.
    // We just continue sending audioInput chunks using the same audioContentName.
    // CRITICAL: Always reset hasSentContentEnd when starting a new turn (sending new audio)
    // This ensures we can send contentEnd for the new turn even if the previous turn didn't complete properly
    if (this.turnCompleted || this.hasSentContentEnd) {
      this.log(`[send] Starting new turn - resetting flags. turnCompleted=${this.turnCompleted}, hasSentContentEnd=${this.hasSentContentEnd}.`);
      const needNewContent = this.hasSentContentEnd;
      this.turnCompleted = false;
      this.hasSentContentEnd = false;
      this.streamRestartAttempted = false;
      if (needNewContent) {
        // contentEnd was sent (via endAudioInput), which closed the audio content container.
        // AWS docs: "All audio frames share a single content container until the conversation
        // ends and it is explicitly closed." Since it was explicitly closed, we need a new
        // contentStart with a new contentName for subsequent audio.
        this.audioContentStarted = false;
        this.log(`[send] contentEnd was previously sent - will create new audio content container`);
      }
      this.log(`[send] State reset: turnCompleted=false, hasSentContentEnd=false, audioContentStarted=${this.audioContentStarted}`);
    }

    // promptStart is now sent during connection, so we just need to ensure audio contentStart is sent
    // Mark prompt as started (it was sent during connection)
    if (!this.promptStarted) {
      this.promptStarted = true;
    }

    // Send AUDIO contentStart on first send() call if not already sent
    // We don't send it during connection to avoid AWS waiting for audio when using text input
    const promptName = (this as any)._promptName as string;
    if (!this.audioContentStarted) {
      // First time sending audio - need to send contentStart first
      const audioContentId = randomUUID();
      this.audioContentName = audioContentId;
      
      this.log(`[send] First audio send - sending AUDIO contentStart with contentName: ${audioContentId}`);
      
      await this.sendClientEvent({
        contentStart: {
          promptName,
          contentName: audioContentId,
          type: "AUDIO",
          interactive: true,
          role: "USER",
          audioInputConfiguration: {
            mediaType: "audio/lpcm",
            sampleRateHertz: 16000,
            sampleSizeBits: 16,
            channelCount: 1,
            encoding: "base64",
            audioType: "SPEECH",
          },
        },
      });
      
      this.audioContentStarted = true;
      this.log(`[send] AUDIO contentStart sent, ready to stream audio`);
    } else {
      this.log(`[send] AUDIO contentStart already sent, sending audioInput chunks directly`);
    }
    
    if (!this.audioContentName) {
      throw new NovaSonicError(
        ErrorCode.INVALID_STATE,
        'Audio content name not initialized. This should not happen.',
      );
    }
    const contentName = this.audioContentName;

    // Convert to base64 and send as audioInput events (AWS expects 'audioInput', not 'audioInputChunk')
    if (audioData instanceof Int16Array) {
      const buffer = Buffer.from(audioData.buffer);
      const base64Audio = buffer.toString('base64');
      this.log(`[send] Sending audioInput chunk, size: ${buffer.length} bytes, contentName: ${contentName}, turnCompleted: ${this.turnCompleted}, hasSentContentEnd: ${this.hasSentContentEnd}, audioContentStarted: ${this.audioContentStarted}, state: ${this.state}`);
      
      // Verify stream is still active
      if (this.state !== 'connected') {
        this.log(`[send] ERROR: State changed to '${this.state}' during send!`);
        throw new NovaSonicError(
          ErrorCode.NOT_CONNECTED,
          `Connection lost during send. State: ${this.state}`,
        );
      }
      
      await this.sendClientEvent({
        audioInput: {
          promptName,
          contentName,
          content: base64Audio,
        },
      });
      this.log(`[send] audioInput chunk sent successfully`);
    } else if (audioData && typeof audioData === 'object' && 'read' in audioData) {
      const stream = audioData as NodeJS.ReadableStream;
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const base64Audio = buffer.toString('base64');
        this.log(`[send] Sending audioInput chunk from stream, size: ${buffer.length} bytes, contentName: ${contentName}, turnCompleted: ${this.turnCompleted}, hasSentContentEnd: ${this.hasSentContentEnd}`);
        await this.sendClientEvent({
          audioInput: {
            promptName,
            contentName,
            content: base64Audio,
          },
        });
      }
    } else {
      throw new NovaSonicError(
        ErrorCode.INVALID_AUDIO_FORMAT,
        'Unsupported audio data format',
      );
    }
  }

  /**
   * End audio input stream (sends contentEnd for audio)
   * Call this when done sending audio chunks
   */
  async endAudioInput(): Promise<void> {
    // Prevent sending contentEnd multiple times for the same turn
    if (this.hasSentContentEnd) {
      this.log('[endAudioInput] contentEnd already sent for this turn, skipping');
      return;
    }
    
    // Prevent sending contentEnd if turn has already been completed by AWS
    // This can happen if the frontend sends contentEnd after AWS has already signaled turn completion
    if (this.turnCompleted) {
      this.log('[endAudioInput] Turn already completed by AWS, skipping contentEnd. Resetting turnCompleted flag for next turn.');
      this.turnCompleted = false; // Reset for next turn
      this.hasSentContentEnd = false; // Reset flag
      return;
    }
    
    if (this.audioContentStarted && this.audioContentName) {
      const promptName = (this as any)._promptName as string;
      this.log('[endAudioInput] Sending contentEnd for audio input');
      await this.sendClientEvent({
        contentEnd: {
          promptName,
          contentName: this.audioContentName,
        },
      });
      this.hasSentContentEnd = true; // Mark that we've sent contentEnd
      // Don't reset state here - it will be reset when we receive contentEnd.type === 'AUDIO' from AWS
    } else {
      this.log('[endAudioInput] Cannot send contentEnd: audioContentStarted=' + this.audioContentStarted + ', audioContentName=' + this.audioContentName);
    }
  }

  /**
   * Start a prompt (send promptStart and system prompt if needed)
   * This is called automatically before the first user input
   */
  private async startPrompt(): Promise<void> {
    const promptName = (this as any)._promptName as string;
    if (!promptName) {
      throw new NovaSonicError(
        ErrorCode.NOT_CONNECTED,
        'Prompt name not initialized. Connection may not be fully established.',
      );
    }

    // Determine voice ID - prioritize sessionConfig.voice, then this.speaker, then default to matthew
    let voiceId = 'matthew'; // Default polyglot voice
    if (this.sessionConfig?.voice) {
      if (typeof this.sessionConfig.voice === 'string') {
        voiceId = this.sessionConfig.voice;
      } else if (this.sessionConfig.voice.name) {
        voiceId = this.sessionConfig.voice.name;
      }
    } else if (this.speaker && this.speaker !== 'default') {
      if (typeof this.speaker === 'string') {
        voiceId = this.speaker;
      } else {
        // Type guard for object with name property
        const speakerObj = this.speaker as { name?: string };
        if (speakerObj && typeof speakerObj === 'object' && speakerObj.name) {
          voiceId = speakerObj.name;
        }
      }
    }
    
    // Send promptStart
    await this.sendClientEvent({
      promptStart: {
        promptName,
        textOutputConfiguration: {
          mediaType: "text/plain",
        },
        audioOutputConfiguration: {
          mediaType: "audio/lpcm",
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: voiceId,
          encoding: "base64",
          audioType: "SPEECH",
        },
      },
    });

    // Send system prompt if instructions are provided
    if (this.instructions) {
      const contentName = randomUUID();
      // Content start
      await this.sendClientEvent({
        contentStart: {
          promptName,
          contentName,
          type: "TEXT",
          interactive: false,
          role: "SYSTEM",
          textInputConfiguration: {
            mediaType: "text/plain",
          },
        },
      });
      // Text input
      await this.sendClientEvent({
        textInput: {
          promptName,
          contentName,
          content: this.instructions,
        },
      });
      // Content end
      await this.sendClientEvent({
        contentEnd: {
          promptName,
          contentName,
        },
      });
    }
  }

  /**
   * Register an event listener
   */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof NovaSonicEventMap ? NovaSonicEventMap[E] : unknown) => void,
  ): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback as EventCallback);
  }

  /**
   * Remove an event listener
   */
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof NovaSonicEventMap ? NovaSonicEventMap[E] : unknown) => void,
  ): void {
    if (!this.events[event]) {
      return;
    }
    const index = this.events[event].indexOf(callback as EventCallback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
    }
  }

  /**
   * Emit an event with arguments
   */
  private emit(event: string, data: unknown): void {
    if (!this.events[event]) {
      this.log(`[NovaSonic] emit('${event}'): No listeners registered for this event`);
      return;
    }
    const listenerCount = this.events[event].length;
    this.log(`[NovaSonic] emit('${event}'): Calling ${listenerCount} listener(s)`);
    for (const callback of this.events[event]) {
      try {
        callback(data);
        this.log(`[NovaSonic] emit('${event}'): Successfully called one listener`);
      } catch (error) {
        this.log(`Error in event handler for ${event}:`, error);
      }
    }
    this.log(`[NovaSonic] emit('${event}'): Finished calling all ${listenerCount} listener(s)`);
  }

  /**
   * Get listener status
   */
  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: this.state === 'connected' };
  }

  /**
   * Log helper
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[NovaSonicVoice]', ...args);
    }
  }
}

