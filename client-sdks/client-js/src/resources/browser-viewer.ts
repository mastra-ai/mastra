import type { BrowserViewerCommand, BrowserViewerEvent } from '@mastra/core/browser';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';

/** Authenticated viewer for an existing exact Controller Session browser launch. */
export class SessionBrowserViewer extends BaseResource {
  private commands: Array<{
    command: BrowserViewerCommand;
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  private sending = false;
  private disposed = false;
  private commandAbort = new AbortController();
  constructor(
    options: ClientOptions,
    private path: string,
  ) {
    // Input commands must never be retried: a lost response may have applied the action.
    super({ ...options, retries: 0 });
  }

  async command(command: BrowserViewerCommand): Promise<void> {
    if (this.disposed) throw new Error('Browser viewer disposed');
    const last = this.commands.at(-1);
    const replaceable = (value: BrowserViewerCommand) =>
      value.type === 'preferences' || (value.type === 'mouse' && value.event.type === 'mouseMoved');
    if (last && replaceable(last.command) && replaceable(command) && last.command.type === command.type) {
      // Intermediate pointer positions and resize observations are obsolete.
      // Never coalesce clicks, keys, text or navigation.
      last.command = command;
      return last.promise;
    }
    if (this.commands.length >= 128) throw new Error('Browser input queue is full');
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    this.commands.push({ command, promise, resolve, reject });
    void this.sendCommands();
    return promise;
  }

  private async sendCommands() {
    if (this.sending) return;
    this.sending = true;
    const resource = new BaseResource({ ...this.options, abortSignal: this.commandAbort.signal });
    try {
      while (this.commands.length) {
        const next = this.commands.shift()!;
        try {
          if (this.disposed) throw new Error('Browser viewer disposed');
          await resource.request(this.path.replace('/browser/stream?', '/browser/commands?'), {
            method: 'POST',
            body: next.command,
          });
          next.resolve();
        } catch (error) {
          next.reject(error);
        }
      }
    } finally {
      this.sending = false;
    }
  }

  /** Stop this handle's pending input; does not close the remote browser. */
  dispose() {
    this.disposed = true;
    this.commandAbort.abort();
  }

  /** No implicit reconnect or browser launch. The caller retains explicit cancellation. */
  async subscribe(options: {
    onEvent: (event: BrowserViewerEvent) => void;
    onError: (error: Error) => void;
    signal?: AbortSignal;
  }): Promise<{ unsubscribe: () => void }> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    this.options.abortSignal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort);
      this.options.abortSignal?.removeEventListener('abort', abort);
    };
    if (options.signal?.aborted || this.options.abortSignal?.aborted) abort();
    const resource = new BaseResource({ ...this.options, abortSignal: controller.signal });
    let response: Response;
    try {
      response = await resource.request<Response>(this.path, { stream: true });
      if (!response.body) throw new Error('Browser stream has no body');
    } catch (error) {
      cleanup();
      throw error;
    }
    const reader = response.body!.getReader();
    const unsubscribe = () => {
      abort();
      void reader.cancel().catch(() => {});
      cleanup();
    };
    void (async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) {
            if (!controller.signal.aborted) throw new Error('Browser stream ended');
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 32 * 1024 * 1024) throw new Error('Browser frame exceeds stream limit');
          let match: RegExpExecArray | null;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            const block = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            const data = block
              .split(/\r?\n/)
              .filter(line => line.startsWith('data:'))
              .map(line => line.slice(5).trimStart())
              .join('\n');
            if (!data) continue;
            const event = JSON.parse(data) as BrowserViewerEvent;
            if (event.type === 'error') {
              options.onError(new Error(event.message));
              unsubscribe();
              return;
            }
            options.onEvent(event);
            if (event.type === 'closed') {
              unsubscribe();
              return;
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) options.onError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        unsubscribe();
        reader.releaseLock();
      }
    })();
    return { unsubscribe };
  }
}
