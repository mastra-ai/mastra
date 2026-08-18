import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import process from 'node:process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type {
  Client,
  InitializeRequest,
  ModelInfo,
  NewSessionRequest,
  NewSessionResponse,
  PermissionOption,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  SessionUpdate,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@agentclientprotocol/sdk';

import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import type { CreateACPToolOptions } from './types';

export type ACPStreamEvent = { type: 'text'; text: string } | { type: 'session-update'; update: SessionUpdate };

type PromptState = {
  sessionId: string;
  onEvent?: (event: ACPStreamEvent) => void;
};

class ACPClient implements Client {
  constructor(
    private readonly getPromptState: () => PromptState | undefined,
    private readonly workspace: Workspace,
    private readonly onPermissionRequest?: CreateACPToolOptions['onPermissionRequest'],
  ) {}

  async sessionUpdate(notification: SessionNotification): Promise<void> {
    const state = this.getPromptState();

    if (!state || notification.sessionId !== state.sessionId) {
      return;
    }

    const update = notification.update;

    if (update.sessionUpdate === 'agent_message_chunk') {
      if (update.content.type === 'text') {
        state.onEvent?.({ type: 'text', text: update.content.text });
      }
    } else {
      state.onEvent?.({ type: 'session-update', update });
    }
  }

  async requestPermission(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    if (this.onPermissionRequest) {
      return this.onPermissionRequest(request);
    }

    const option = request.options[0];

    if (!option) {
      return { outcome: { outcome: 'cancelled' } };
    }

    return { outcome: selectedPermissionOutcome(option) };
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    let content = await this.workspace.filesystem?.readFile(params.path);

    if (!(typeof content === 'string')) {
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(content);
    }

    if (params.line != null || params.limit != null) {
      const lines = content.split('\n');
      const start = (params.line ?? 1) - 1;
      const end = params.limit != null ? start + params.limit : lines.length;
      return { content: lines.slice(start, end).join('\n') };
    }

    return { content };
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    await this.workspace.filesystem?.writeFile(params.path, params.content);

    return {};
  }
}

export class ACPConnection {
  readonly options: CreateACPToolOptions;

  private agentProcess?: ChildProcessWithoutNullStreams;
  private connection?: ClientSideConnection;
  private session?: NewSessionResponse;
  private initializePromise?: Promise<void>;
  private currentPrompt?: PromptState;
  private stderr = '';

  constructor(options: CreateACPToolOptions) {
    this.options = options;
  }

  get sessionId(): string | undefined {
    return this.session?.sessionId;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    await this.ensureConnected();
    return this.session?.models?.availableModels ?? [];
  }

  async setModel(modelId: string): Promise<void> {
    await this.ensureConnected();

    const available = this.session?.models?.availableModels;

    if (available && !available.some(m => m.modelId === modelId)) {
      const ids = available.map(m => m.modelId).join(', ') || '(none)';
      throw new Error(`Model "${modelId}" is not available. Available models: ${ids}`);
    }

    await this.connection!.unstable_setSessionModel({
      sessionId: this.session!.sessionId,
      modelId,
    });
  }

  async prompt(task: string, signal?: AbortSignal): Promise<string> {
    const parts: string[] = [];

    for await (const event of this.promptStream(task, signal)) {
      if (event.type === 'text') {
        parts.push(event.text);
      }
    }

    return parts.join('');
  }

  async *promptStream(task: string, signal?: AbortSignal): AsyncGenerator<ACPStreamEvent> {
    await this.ensureConnected();

    const sessionId = this.session?.sessionId;

    if (!this.connection || !sessionId) {
      throw new Error('ACP connection is not initialized');
    }

    if (signal?.aborted) {
      await this.cancel();
      throw signal.reason ?? new Error('ACP prompt aborted');
    }

    const queue = createAsyncQueue<ACPStreamEvent>();
    const state: PromptState = {
      sessionId,
      onEvent: event => queue.push(event),
    };
    this.currentPrompt = state;

    const abortHandler = () => {
      void this.cancel();
      queue.throw(signal?.reason ?? new Error('ACP prompt aborted'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    const responsePromise = this.connection
      .prompt({
        sessionId,
        prompt: [{ type: 'text', text: task }],
      })
      .then(
        response => {
          this.throwIfPromptDidNotComplete(response);
          queue.close();
        },
        error => {
          queue.throw(this.withStderr(error));
        },
      );

    try {
      for await (const chunk of queue) {
        yield chunk;
      }

      await responsePromise;
    } catch (error) {
      await responsePromise.catch(() => undefined);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortHandler);
      if (this.currentPrompt === state) {
        this.currentPrompt = undefined;
      }

      if (this.options.persistSession === false) {
        this.disconnect();
      }
    }
  }

  async cancel(): Promise<void> {
    const sessionId = this.session?.sessionId;

    if (!this.connection || !sessionId) {
      return;
    }

    await this.connection.cancel({ sessionId });
  }

  disconnect(): void {
    this.connection = undefined;
    this.session = undefined;
    this.initializePromise = undefined;
    this.currentPrompt = undefined;

    if (this.agentProcess && !this.agentProcess.killed) {
      this.agentProcess.kill();
    }

    this.agentProcess = undefined;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection && this.session) {
      return;
    }

    this.initializePromise ??= this.initialize();
    await this.initializePromise;
  }

  private async initialize(): Promise<void> {
    this.stderr = '';
    this.agentProcess = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Keep an 'error' listener attached for the lifetime of the process so a
    // failed spawn (e.g. ENOENT) rejects initialization instead of crashing
    // the host process with an unhandled 'error' event.
    const processFailure = new Promise<never>((_, reject) => {
      this.agentProcess!.on('error', error => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
      this.agentProcess!.on('exit', (code, signal) => {
        reject(new Error(`ACP agent process exited during initialization (code: ${code}, signal: ${signal})`));
      });
    });
    processFailure.catch(() => undefined);

    this.agentProcess.stderr.on('data', chunk => {
      this.stderr += String(chunk);
    });

    const stream = ndJsonStream(
      Writable.toWeb(this.agentProcess.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(this.agentProcess.stdout) as ReadableStream<Uint8Array>,
    );

    const workspace =
      this.options.workspace ??
      new Workspace({
        filesystem: new LocalFilesystem({ basePath: this.options.cwd ?? process.cwd() }),
      });

    try {
      this.connection = new ClientSideConnection(() => {
        const defaultClient = new ACPClient(() => this.currentPrompt, workspace, this.options.onPermissionRequest);
        return this.options.createClient?.(defaultClient) ?? defaultClient;
      }, stream);

      await Promise.race([processFailure, this.initializeSession()]);
    } catch (error) {
      this.disconnect();
      throw this.withStderr(error);
    }
  }

  private async initializeSession(): Promise<void> {
    await this.connection!.initialize(this.getInitializeRequest());

    if (this.options.authMethodId) {
      await this.connection!.authenticate({ methodId: this.options.authMethodId });
    }

    this.session = await this.connection!.newSession(this.getNewSessionRequest());

    if (this.options.model) {
      const available = this.session.models?.availableModels;

      if (available && !available.some(m => m.modelId === this.options.model)) {
        const ids = available.map(m => m.modelId).join(', ') || '(none)';
        throw new Error(`Model "${this.options.model}" is not available. Available models: ${ids}`);
      }

      await this.connection!.unstable_setSessionModel({
        sessionId: this.session.sessionId,
        modelId: this.options.model,
      });
    }
  }

  private getInitializeRequest(): InitializeRequest {
    return {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
      clientInfo: {
        name: '@mastra/acp',
        version: '0.1.0',
      },
      ...this.options.initialize,
    };
  }

  private getNewSessionRequest(): NewSessionRequest {
    return {
      cwd: this.options.cwd ?? process.cwd(),
      mcpServers: [],
      ...this.options.session,
    };
  }

  private throwIfPromptDidNotComplete(response: PromptResponse): void {
    if (response.stopReason === 'end_turn') {
      return;
    }

    throw new Error(`ACP prompt stopped before completing: ${response.stopReason}`);
  }

  private withStderr(error: unknown): Error {
    const stderr = this.stderr.trim();

    if (error instanceof Error) {
      if (stderr && !error.message.includes(stderr)) {
        error.message = `${error.message}\n\nACP agent stderr:\n${stderr}`;
      }

      return error;
    }

    return new Error(stderr ? `${String(error)}\n\nACP agent stderr:\n${stderr}` : String(error));
  }
}

type AsyncQueue<T> = AsyncIterable<T> & {
  close: () => void;
  push: (value: T) => void;
  throw: (error: unknown) => void;
};

function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: T[] = [];
  const waiters: Array<{
    resolve: (value: IteratorResult<T>) => void;
    reject: (error: unknown) => void;
  }> = [];
  let closed = false;
  let error: unknown;

  const next = (): Promise<IteratorResult<T>> => {
    if (values.length > 0) {
      return Promise.resolve({ value: values.shift()!, done: false });
    }

    if (error) {
      return Promise.reject(error);
    }

    if (closed) {
      return Promise.resolve({ value: undefined, done: true });
    }

    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  };

  return {
    push(value) {
      const waiter = waiters.shift();
      if (waiter) {
        waiter.resolve({ value, done: false });
        return;
      }

      values.push(value);
    },
    close() {
      closed = true;
      for (const waiter of waiters.splice(0)) {
        waiter.resolve({ value: undefined, done: true });
      }
    },
    throw(queueError) {
      error = queueError;
      for (const waiter of waiters.splice(0)) {
        waiter.reject(queueError);
      }
    },
    [Symbol.asyncIterator]() {
      return { next };
    },
  };
}

function selectedPermissionOutcome(option: PermissionOption): RequestPermissionResponse['outcome'] {
  return { outcome: 'selected', optionId: option.optionId };
}
