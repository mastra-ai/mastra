import { EventEmitter } from 'events';

export interface SessionConfig {
  debug: boolean;
  timeoutMs?: number;
  maxSessionDuration?: number;
}

export interface SessionInfo {
  id?: string;
  handle?: string;
  startTime?: Date;
  duration?: number;
  state: string;
  config?: any;
  contextSize: number;
}

export class SessionManager {
  private eventEmitter: EventEmitter;
  private readonly debug: boolean;
  private readonly timeoutMs: number;
  private readonly maxSessionDuration: number;

  // Session state
  private sessionId?: string;
  private sessionHandle?: string;
  private sessionStartTime?: Date;
  private isResuming = false;
  private sessionDurationTimeout?: NodeJS.Timeout;

  constructor(config: SessionConfig) {
    this.eventEmitter = new EventEmitter();
    this.debug = config.debug;
    this.timeoutMs = config.timeoutMs || 30000;
    this.maxSessionDuration = config.maxSessionDuration || 300000; // 5 minutes default
  }

  /**
   * Set session ID
   */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Set session handle
   */
  setSessionHandle(handle: string): void {
    this.sessionHandle = handle;
  }

  /**
   * Get session handle
   */
  getSessionHandle(): string | undefined {
    return this.sessionHandle;
  }

  /**
   * Start session timing
   */
  startSession(): void {
    this.sessionStartTime = new Date();
    this.startSessionDurationMonitor();
  }

  /**
   * Check if session is resuming
   */
  isSessionResuming(): boolean {
    return this.isResuming;
  }

  /**
   * Set resuming state
   */
  setResuming(resuming: boolean): void {
    this.isResuming = resuming;
  }

  /**
   * Wait for session to be created and ready
   */
  async waitForSessionCreated(): Promise<void> {
    return new Promise((resolve, reject) => {
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
      }, this.timeoutMs);
    });
  }

  /**
   * Start session duration monitoring
   */
  private startSessionDurationMonitor(): void {
    // Clear any existing timeout
    if (this.sessionDurationTimeout) {
      clearTimeout(this.sessionDurationTimeout);
    }

    // Set new timeout for maximum session duration
    this.sessionDurationTimeout = setTimeout(() => {
      this.log('Session duration limit reached, ending session');
      this.eventEmitter.emit('sessionDurationLimit');
    }, this.maxSessionDuration);
  }

  /**
   * Get session information
   */
  getSessionInfo(): SessionInfo {
    const startTime = this.sessionStartTime;
    const duration = startTime ? Date.now() - startTime.getTime() : undefined;

    return {
      id: this.sessionId,
      handle: this.sessionHandle,
      startTime,
      duration,
      state: this.getSessionState(),
      config: undefined, // TODO: Add session config when available
      contextSize: 0, // TODO: Add context size tracking
    };
  }

  /**
   * Get current session state
   */
  private getSessionState(): string {
    if (!this.sessionId) return 'disconnected';
    if (this.isResuming) return 'resuming';
    if (this.sessionStartTime) return 'active';
    return 'connecting';
  }

  /**
   * Reset session state
   */
  reset(): void {
    this.sessionId = undefined;
    this.sessionHandle = undefined;
    this.sessionStartTime = undefined;
    this.isResuming = false;

    if (this.sessionDurationTimeout) {
      clearTimeout(this.sessionDurationTimeout);
      this.sessionDurationTimeout = undefined;
    }
  }

  /**
   * Get event emitter for session events
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[SessionManager] ${message}`, ...args);
    }
  }
}
