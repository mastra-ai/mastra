import type { ServerResponse } from 'node:http';

class MockServerResponse {
  writtenChunks: any[] = [];
  headers = {};
  statusCode = 0;
  statusMessage = '';
  ended = false;
  private eventListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  write(chunk: any): boolean {
    this.writtenChunks.push(chunk);
    return true; // Return true to indicate success
  }

  end(chunk?: any): void {
    // If a final chunk is provided, write it first
    if (chunk !== undefined) {
      this.write(chunk);
    }
    // Mark the response as ended to simulate the real behavior
    this.ended = true;
    // Emit the 'close' event when ending
    this.emit('close');
  }

  writeHead(statusCode: number, statusMessage: string, headers: Record<string, string>): void {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
    this.headers = headers;
  }

  // Add event emitter methods required by AI SDK
  once(event: string, listener: (...args: any[]) => void): this {
    const listeners = this.eventListeners.get(event) || [];
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    listeners.push(onceWrapper);
    this.eventListeners.set(event, listeners);
    return this;
  }

  on(event: string, listener: (...args: any[]) => void): this {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
    return listeners.length > 0;
  }

  get body() {
    // Combine all written chunks into a single string
    return this.writtenChunks.join('');
  }

  /**
   * Get the decoded chunks as strings.
   */
  getDecodedChunks() {
    const decoder = new TextDecoder();
    return this.writtenChunks.map(chunk => decoder.decode(chunk));
  }

  /**
   * Wait for the stream to finish writing to the mock response.
   */
  async waitForEnd() {
    await new Promise(resolve => {
      const checkIfEnded = () => {
        if (this.ended) {
          resolve(undefined);
        } else {
          setImmediate(checkIfEnded);
        }
      };
      checkIfEnded();
    });
  }
}

export function createMockServerResponse(): ServerResponse & MockServerResponse {
  return new MockServerResponse() as ServerResponse & MockServerResponse;
}
