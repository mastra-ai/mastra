import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { GeminiLiveErrorCode } from '../types';
import { GeminiLiveError } from '../utils/errors';

export interface ConnectionConfig {
  debug: boolean;
  timeoutMs?: number;
}

export class ConnectionManager {
  private ws?: WebSocket;
  private eventEmitter: EventEmitter;
  private readonly debug: boolean;
  private readonly timeoutMs: number;

  constructor(config: ConnectionConfig) {
    this.eventEmitter = new EventEmitter();
    this.debug = config.debug;
    this.timeoutMs = config.timeoutMs || 30000;
  }

  /**
   * Set the WebSocket instance
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  /**
   * Get the current WebSocket instance
   */
  getWebSocket(): WebSocket | undefined {
    return this.ws;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if WebSocket is connecting
   */
  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }

  /**
   * Check if WebSocket is closed
   */
  isClosed(): boolean {
    return this.ws?.readyState === WebSocket.CLOSED;
  }

  /**
   * Wait for WebSocket to open
   */
  async waitForOpen(): Promise<void> {
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
        reject(new GeminiLiveError(GeminiLiveErrorCode.CONNECTION_FAILED, 'WebSocket connection timeout'));
      }, this.timeoutMs);
    });
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | Buffer): void {
    if (!this.ws) {
      throw new GeminiLiveError(GeminiLiveErrorCode.CONNECTION_NOT_ESTABLISHED, 'WebSocket not initialized');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new GeminiLiveError(GeminiLiveErrorCode.CONNECTION_NOT_ESTABLISHED, 'WebSocket is not open');
    }

    this.ws.send(data);
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'closed' {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'disconnected';
    }
  }

  /**
   * Validate WebSocket state for operations
   */
  validateWebSocketState(): void {
    if (!this.ws) {
      throw new GeminiLiveError(GeminiLiveErrorCode.CONNECTION_NOT_ESTABLISHED, 'WebSocket not initialized');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new GeminiLiveError(GeminiLiveErrorCode.CONNECTION_NOT_ESTABLISHED, 'WebSocket is not open');
    }
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.info(`[ConnectionManager] ${message}`, ...args);
    }
  }
}
