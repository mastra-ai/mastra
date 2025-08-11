import { PassThrough } from 'stream';
import type { AudioConfig } from '../types';

/**
 * Default audio configuration for Gemini Live API
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  encoding: 'pcm16',
  channels: 1,
};

/**
 * Manages audio streams for the Gemini Live Voice API
 * Handles speaker stream lifecycle, cleanup, and audio processing
 */
export class AudioStreamManager {
  private speakerStreams = new Map<string, PassThrough & { id?: string; created?: number }>();
  private currentResponseId?: string;
  private readonly MAX_CONCURRENT_STREAMS = 10;
  private readonly STREAM_TIMEOUT_MS = 30000; // 30 seconds
  private readonly debug: boolean;
  private readonly audioConfig: AudioConfig;
  private readonly maxChunkSize = 32768; // 32KB max chunk size per Gemini limits
  private readonly minSendInterval = 0; // No throttling - let the stream control the pace
  private lastSendTime = 0;
  private pendingChunks: Array<{ chunk: Buffer; timestamp: number }> = [];
  private pendingTimer?: NodeJS.Timeout;
  private sendToGemini?: (type: 'realtime_input' | 'client_content', message: Record<string, unknown>) => void;

  // Audio buffer management constants
  private readonly MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB maximum buffer size
  private readonly MAX_AUDIO_DURATION = 300; // 5 minutes maximum audio duration

  constructor(audioConfig: AudioConfig, debug: boolean = false) {
    this.audioConfig = audioConfig;
    this.debug = debug;
  }

  /**
   * Provide a sender callback that will be used to deliver messages to Gemini
   */
  setSender(sender: (type: 'realtime_input' | 'client_content', message: Record<string, unknown>) => void): void {
    this.sendToGemini = sender;
  }

  /**
   * Get the default audio configuration
   */
  static getDefaultAudioConfig(): AudioConfig {
    return { ...DEFAULT_AUDIO_CONFIG };
  }

  /**
   * Create a merged audio configuration with defaults
   */
  static createAudioConfig(customConfig?: Partial<AudioConfig>): AudioConfig {
    return {
      ...DEFAULT_AUDIO_CONFIG,
      ...customConfig,
    };
  }

  /**
   * Get the current response ID for the next audio chunk
   */
  getCurrentResponseId(): string | undefined {
    return this.currentResponseId;
  }

  /**
   * Set the current response ID for the next audio chunk
   */
  setCurrentResponseId(responseId: string): void {
    this.currentResponseId = responseId;
  }

  /**
   * Get the current speaker stream
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
   * Add a new speaker stream for a response
   */
  addSpeakerStream(responseId: string, stream: PassThrough): void {
    const streamWithMetadata = Object.assign(stream, {
      id: responseId,
      created: Date.now(),
    });

    this.speakerStreams.set(responseId, streamWithMetadata);
    this.log(`Added speaker stream for response: ${responseId}`);

    // Enforce stream limits after adding
    this.enforceStreamLimits();
  }

  /**
   * Remove a specific speaker stream
   */
  removeSpeakerStream(responseId: string): void {
    const stream = this.speakerStreams.get(responseId);
    if (stream && !stream.destroyed) {
      stream.end();
      setTimeout(() => {
        if (!stream.destroyed) {
          stream.destroy();
          this.log(`Force destroyed stream for response: ${responseId}`);
        }
      }, 1000);
    }

    this.speakerStreams.delete(responseId);
    this.log(`Removed speaker stream for response: ${responseId}`);
  }

  /**
   * Clean up all speaker streams
   */
  cleanupSpeakerStreams(): void {
    try {
      if (this.speakerStreams.size === 0) {
        return;
      }

      this.log(`Cleaning up ${this.speakerStreams.size} speaker streams`);

      for (const [responseId, stream] of this.speakerStreams.entries()) {
        try {
          // Check if stream is already ended/destroyed
          if (!stream.destroyed) {
            stream.end();

            // Force destroy after a short timeout if end() doesn't work
            setTimeout(() => {
              if (!stream.destroyed) {
                stream.destroy();
                this.log(`Force destroyed stream for response: ${responseId}`);
              }
            }, 1000);
          }

          this.speakerStreams.delete(responseId);
          this.log(`Cleaned up speaker stream for response: ${responseId}`);
        } catch (streamError) {
          this.log(`Error cleaning up stream ${responseId}:`, streamError);
          // Force remove from map even if cleanup failed
          this.speakerStreams.delete(responseId);
        }
      }

      this.currentResponseId = undefined;
      this.log('All speaker streams cleaned up');
    } catch (error) {
      this.log('Error during speaker stream cleanup:', error);
      // Force clear the map if cleanup fails
      this.speakerStreams.clear();
      this.currentResponseId = undefined;
    }
  }

  /**
   * Clean up old/stale streams to prevent memory leaks
   */
  cleanupStaleStreams(): void {
    try {
      const now = Date.now();
      const staleCutoff = now - this.STREAM_TIMEOUT_MS;
      const staleStreams: string[] = [];

      for (const [responseId, stream] of this.speakerStreams.entries()) {
        const created = stream.created || 0;
        if (created < staleCutoff) {
          staleStreams.push(responseId);
        }
      }

      if (staleStreams.length > 0) {
        this.log(`Cleaning up ${staleStreams.length} stale streams`);
        for (const responseId of staleStreams) {
          const stream = this.speakerStreams.get(responseId);
          if (stream && !stream.destroyed) {
            stream.end();
          }
          this.speakerStreams.delete(responseId);
        }
      }
    } catch (error) {
      this.log('Error cleaning up stale streams:', error);
    }
  }

  /**
   * Enforce stream limits to prevent memory exhaustion
   */
  enforceStreamLimits(): void {
    try {
      if (this.speakerStreams.size <= this.MAX_CONCURRENT_STREAMS) {
        return;
      }

      this.log(
        `Stream limit exceeded (${this.speakerStreams.size}/${this.MAX_CONCURRENT_STREAMS}), cleaning up oldest streams`,
      );

      // Sort streams by creation time and remove oldest ones
      const sortedStreams = Array.from(this.speakerStreams.entries()).sort(
        ([, a], [, b]) => (a.created || 0) - (b.created || 0),
      );

      const streamsToRemove = sortedStreams.slice(0, this.speakerStreams.size - this.MAX_CONCURRENT_STREAMS);

      for (const [responseId, stream] of streamsToRemove) {
        if (!stream.destroyed) {
          stream.end();
        }
        this.speakerStreams.delete(responseId);
        this.log(`Removed old stream for response: ${responseId}`);
      }
    } catch (error) {
      this.log('Error enforcing stream limits:', error);
    }
  }

  /**
   * Get information about current streams for debugging
   */
  getStreamInfo(): {
    totalStreams: number;
    currentResponseId?: string;
    streamDetails: Array<{ responseId: string; created: number; destroyed: boolean }>;
  } {
    const streamDetails = Array.from(this.speakerStreams.entries()).map(([responseId, stream]) => ({
      responseId,
      created: stream.created || 0,
      destroyed: stream.destroyed,
    }));

    return {
      totalStreams: this.speakerStreams.size,
      currentResponseId: this.currentResponseId,
      streamDetails,
    };
  }

  /**
   * Convert Int16Array audio data to base64 string for WebSocket transmission
   */
  int16ArrayToBase64(int16Array: Int16Array): string {
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
   */
  base64ToInt16Array(base64Audio: string): Int16Array {
    try {
      const buffer = Buffer.from(base64Audio, 'base64');

      // Convert Buffer to Int16Array
      if (buffer.length % 2 !== 0) {
        throw new Error('Invalid audio data: buffer length must be even for 16-bit audio');
      }

      return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    } catch (error) {
      throw new Error(
        `Failed to decode base64 audio data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate and convert audio data to the required format for Gemini Live API
   * Gemini Live expects 16kHz PCM16 for input
   */
  validateAndConvertAudioInput(audioData: Buffer | Int16Array): Int16Array {
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
   */
  processAudioChunk(chunk: Buffer | Uint8Array | Int16Array): string {
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
   */
  validateAudioFormat(sampleRate?: number, channels?: number): void {
    if (sampleRate && sampleRate !== this.audioConfig.inputSampleRate) {
      this.log(
        `Warning: Audio sample rate ${sampleRate}Hz does not match expected ${this.audioConfig.inputSampleRate}Hz`,
      );
    }

    if (channels && channels !== this.audioConfig.channels) {
      throw new Error(`Unsupported channel count: ${channels}. Gemini Live API requires mono audio (1 channel)`);
    }
  }

  /**
   * Create an audio message for the Gemini Live API
   */
  createAudioMessage(audioData: string, messageType: 'input' | 'realtime' = 'realtime'): Record<string, unknown> {
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
                    data: audioData,
                  },
                },
              ],
            },
          ],
          turnComplete: true,
        },
      };
    } else {
      // For real-time streaming
      return {
        realtime_input: {
          media_chunks: [
            {
              mime_type: 'audio/pcm',
              data: audioData,
            },
          ],
        },
      };
    }
  }

  /**
   * Get a speaker stream by response ID
   */
  getSpeakerStream(responseId: string): PassThrough | undefined {
    return this.speakerStreams.get(responseId);
  }

  /**
   * Create a new speaker stream for a response ID
   */
  createSpeakerStream(responseId: string): PassThrough {
    const stream = new PassThrough() as PassThrough & { id?: string; created?: number };
    stream.id = responseId;
    stream.created = Date.now();

    // Add the stream to the manager
    this.addSpeakerStream(responseId, stream);

    return stream;
  }

  /**
   * Get the number of active streams
   */
  getActiveStreamCount(): number {
    return this.speakerStreams.size;
  }

  /**
   * Check if a specific response ID has an active stream
   */
  hasStream(responseId: string): boolean {
    return this.speakerStreams.has(responseId);
  }

  /**
   * Get all active response IDs
   */
  getActiveResponseIds(): string[] {
    return Array.from(this.speakerStreams.keys());
  }

  /**
   * Reset the manager state (useful for testing or reconnection)
   */
  reset(): void {
    this.cleanupSpeakerStreams();
    this.currentResponseId = undefined;
    this.log('AudioStreamManager reset');
  }

  /**
   * Validate audio chunk size and format
   */
  validateAudioChunk(chunk: Buffer): void {
    if (chunk.length === 0) {
      throw new Error('Audio chunk cannot be empty');
    }

    if (chunk.length > this.maxChunkSize) {
      throw new Error(`Audio chunk size ${chunk.length} exceeds maximum allowed size ${this.maxChunkSize}`);
    }

    if (chunk.length % 2 !== 0) {
      throw new Error('Audio chunk length must be even for 16-bit audio');
    }
  }

  /**
   * Send audio chunk with throttling and validation
   */
  sendAudioChunk(chunk: Buffer): void {
    try {
      this.validateAudioChunk(chunk);

      const now = Date.now();
      if (now - this.lastSendTime < this.minSendInterval) {
        // Throttle if needed - enqueue for later processing
        this.pendingChunks.push({ chunk, timestamp: now });
        const delay = this.minSendInterval - (now - this.lastSendTime);
        if (!this.pendingTimer) {
          this.pendingTimer = setTimeout(
            () => {
              this.pendingTimer = undefined;
              this.processPendingChunks();
            },
            Math.max(0, delay),
          );
        }
        return;
      }

      this.processChunk(chunk);
      this.processPendingChunks();
    } catch (error) {
      this.log('Error sending audio chunk:', error);
      throw error;
    }
  }

  /**
   * Handle audio stream processing
   */
  async handleAudioStream(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        stream.removeAllListeners();
      };

      stream.on('data', (chunk: Buffer) => {
        try {
          if (chunk.length > this.maxChunkSize) {
            // Split large chunks
            const chunks = this.splitAudioChunk(chunk);
            for (const subChunk of chunks) {
              this.validateAudioChunk(subChunk);
              this.sendAudioChunk(subChunk);
            }
          } else {
            this.validateAudioChunk(chunk);
            this.sendAudioChunk(chunk);
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

      stream.on('end', () => {
        cleanup();
        resolve();
      });

      stream.on('error', error => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * Split large audio chunks into smaller ones
   */
  private splitAudioChunk(chunk: Buffer): Buffer[] {
    const chunks: Buffer[] = [];
    let offset = 0;

    while (offset < chunk.length) {
      const size = Math.min(this.maxChunkSize, chunk.length - offset);
      chunks.push(chunk.subarray(offset, offset + size));
      offset += size;
    }

    return chunks;
  }

  /**
   * Calculate audio duration from buffer length
   */
  calculateAudioDuration(bufferLength: number, sampleRate?: number): number {
    const effectiveSampleRate = sampleRate || this.audioConfig.inputSampleRate;
    return bufferLength / (effectiveSampleRate * 2); // 2 bytes per sample for 16-bit audio
  }

  /**
   * Validate audio buffer size and duration
   */
  validateAudioBuffer(buffer: Buffer): void {
    if (buffer.length === 0) {
      throw new Error('Audio buffer cannot be empty');
    }

    if (buffer.length > this.MAX_BUFFER_SIZE) {
      throw new Error(
        `Audio buffer size ${buffer.length} exceeds maximum allowed size ${this.MAX_BUFFER_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (buffer.length % 2 !== 0) {
      throw new Error('Audio buffer length must be even for 16-bit audio');
    }

    const duration = this.calculateAudioDuration(buffer.length);
    if (duration > this.MAX_AUDIO_DURATION) {
      throw new Error(
        `Audio duration ${duration.toFixed(2)}s exceeds maximum allowed duration ${this.MAX_AUDIO_DURATION}s`,
      );
    }
  }

  /**
   * Process audio buffer for transcription
   * Combines chunks, validates format, and converts to base64
   */
  processAudioBufferForTranscription(audioBuffer: Buffer): { base64Audio: string; duration: number; size: number } {
    // Validate audio format
    if (audioBuffer.length % 2 !== 0) {
      throw new Error('Invalid audio data: buffer length must be even for 16-bit audio');
    }

    // Calculate duration
    const duration = this.calculateAudioDuration(audioBuffer.length);

    // Convert to base64
    const base64Audio = audioBuffer.toString('base64');

    return {
      base64Audio,
      duration,
      size: audioBuffer.length,
    };
  }

  /**
   * Process audio chunks for transcription with buffer management
   * Handles chunk collection, size validation, and buffer management
   */
  processAudioChunksForTranscription(
    chunks: Buffer[],
    totalBufferSize: number,
  ): { audioBuffer: Buffer; base64Audio: string; duration: number; size: number } {
    // Check buffer size to prevent memory overflow
    if (totalBufferSize > this.MAX_BUFFER_SIZE) {
      throw new Error(`Audio data exceeds maximum size of ${this.MAX_BUFFER_SIZE / (1024 * 1024)}MB`);
    }

    // Combine all chunks
    const audioBuffer = Buffer.concat(chunks);

    // Process for transcription
    const result = this.processAudioBufferForTranscription(audioBuffer);

    return {
      audioBuffer,
      ...result,
    };
  }

  /**
   * Validate audio chunks and calculate total size
   */
  validateAudioChunks(chunks: Buffer[]): { totalSize: number; isValid: boolean; error?: string } {
    let totalSize = 0;

    for (const chunk of chunks) {
      if (!Buffer.isBuffer(chunk)) {
        return { totalSize: 0, isValid: false, error: 'Invalid chunk format' };
      }

      totalSize += chunk.length;

      if (totalSize > this.MAX_BUFFER_SIZE) {
        return {
          totalSize,
          isValid: false,
          error: `Total size ${totalSize} exceeds maximum allowed size ${this.MAX_BUFFER_SIZE}`,
        };
      }
    }

    return { totalSize, isValid: true };
  }

  /**
   * Get audio buffer limits and configuration
   */
  getAudioBufferLimits(): { maxBufferSize: number; maxAudioDuration: number; maxChunkSize: number } {
    return {
      maxBufferSize: this.MAX_BUFFER_SIZE,
      maxAudioDuration: this.MAX_AUDIO_DURATION,
      maxChunkSize: this.maxChunkSize,
    };
  }

  /**
   * Get audio configuration
   */
  getAudioConfig(): AudioConfig {
    return this.audioConfig;
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[AudioStreamManager] ${message}`, ...args);
    }
  }

  /**
   * Handle complete audio transcription workflow
   * Manages stream processing, chunk collection, and transcription
   */
  async handleAudioTranscription(
    audioStream: NodeJS.ReadableStream,
    sendAndAwaitTranscript: (base64Audio: string) => Promise<string>,
    onError: (error: Error) => void,
    timeoutMs: number = 30000,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let isCleanedUp = false;
      let totalBufferSize = 0;
      let isResolved = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          reject(new Error(`Transcription timeout - no response received within ${timeoutMs / 1000} seconds`));
        }
      }, timeoutMs);

      // Stream event handlers
      const onStreamData = (chunk: Buffer) => {
        try {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

          // Check buffer size to prevent memory overflow
          totalBufferSize += buffer.length;
          if (totalBufferSize > this.MAX_BUFFER_SIZE) {
            cleanup();
            reject(new Error(`Audio data exceeds maximum size of ${this.MAX_BUFFER_SIZE / (1024 * 1024)}MB`));
            return;
          }

          chunks.push(buffer);
        } catch (error) {
          cleanup();
          reject(
            new Error(`Failed to process audio chunk: ${error instanceof Error ? error.message : 'Unknown error'}`),
          );
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

          // Process chunks for transcription
          const result = this.processAudioChunksForTranscription(chunks, totalBufferSize);

          this.log('Processing audio for transcription:', {
            chunks: chunks.length,
            totalSize: result.size,
            duration: result.duration,
          });

          // Send audio and await the transcript from the caller
          try {
            const transcript = await sendAndAwaitTranscript(result.base64Audio);
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve(transcript.trim());
            }
          } catch (error) {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              reject(
                new Error(
                  `Failed to obtain transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ),
              );
            }
          }
        } catch (error) {
          cleanup();
          reject(
            new Error(`Failed to process audio stream: ${error instanceof Error ? error.message : 'Unknown error'}`),
          );
        }
      };

      // Comprehensive cleanup function
      const cleanup = () => {
        if (isCleanedUp) return; // Prevent double cleanup
        isCleanedUp = true;

        // Clear all timers
        clearTimeout(timeout);

        // Remove stream event listeners
        audioStream.removeListener('data', onStreamData);
        audioStream.removeListener('error', onStreamError);
        audioStream.removeListener('end', onStreamEnd);

        // Clear chunks array to free memory
        chunks.length = 0;
      };

      // Set up stream event listeners
      audioStream.on('data', onStreamData);
      audioStream.on('error', onStreamError);
      audioStream.on('end', onStreamEnd);
    });
  }

  private processChunk(chunk: Buffer): void {
    // Convert raw audio buffer to base64 PCM16 and build message
    const base64Audio = this.processAudioChunk(chunk);
    const message = this.createAudioMessage(base64Audio, 'realtime');

    // Send via injected sender
    if (this.sendToGemini) {
      this.sendToGemini('realtime_input', message);
    } else {
      this.log('No sender configured for AudioStreamManager; dropping audio chunk');
    }

    // Update throttle timing and log
    this.lastSendTime = Date.now();
    this.log(`Sent audio chunk of size: ${chunk.length} bytes`);
  }

  private processPendingChunks(): void {
    while (this.pendingChunks.length > 0) {
      const nextChunk = this.pendingChunks[0];
      const now = Date.now();
      if (nextChunk && now - this.lastSendTime >= this.minSendInterval) {
        this.pendingChunks.shift();
        this.processChunk(nextChunk.chunk);
      } else {
        const delay = this.minSendInterval - (now - this.lastSendTime);
        if (!this.pendingTimer) {
          this.pendingTimer = setTimeout(
            () => {
              this.pendingTimer = undefined;
              this.processPendingChunks();
            },
            Math.max(0, delay),
          );
        }
        break;
      }
    }
  }
}
