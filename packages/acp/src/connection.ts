import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import process from 'node:process';
import { Readable, Writable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type {
  Client,
  ContentBlock,
  ContentChunk,
  InitializeRequest,
  NewSessionRequest,
  NewSessionResponse,
  PermissionOption,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@agentclientprotocol/sdk';

import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import type { CreateACPToolOptions } from './types';

type PromptState = {
  sessionId: string;
  chunks: string[];
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
      appendContentChunk(state.chunks, update);
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

  async prompt(task: string, signal?: AbortSignal): Promise<string> {
    await this.ensureConnected();

    const sessionId = this.session?.sessionId;

    if (!this.connection || !sessionId) {
      throw new Error('ACP connection is not initialized');
    }

    if (signal?.aborted) {
      await this.cancel();
      throw signal.reason ?? new Error('ACP prompt aborted');
    }

    const state: PromptState = { sessionId, chunks: [] };
    this.currentPrompt = state;

    const abortHandler = () => {
      void this.cancel();
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      const response = await this.connection.prompt({
        sessionId,
        prompt: [{ type: 'text', text: task }],
      });

      this.throwIfPromptDidNotComplete(response);

      return state.chunks.join('');
    } catch (error) {
      throw this.withStderr(error);
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

    this.connection = new ClientSideConnection(
      () => new ACPClient(() => this.currentPrompt, workspace, this.options.onPermissionRequest),
      stream,
    );

    try {
      await this.connection.initialize(this.getInitializeRequest());

      if (this.options.authMethodId) {
        await this.connection.authenticate({ methodId: this.options.authMethodId });
      }

      this.session = await this.connection.newSession(this.getNewSessionRequest());
    } catch (error) {
      this.disconnect();
      throw this.withStderr(error);
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

function appendContentChunk(chunks: string[], chunk: ContentChunk): void {
  appendContentBlock(chunks, chunk.content);
}

function appendContentBlock(chunks: string[], content: ContentBlock): void {
  if (content.type === 'text') {
    chunks.push(content.text);
  }
}

function selectedPermissionOutcome(option: PermissionOption): RequestPermissionResponse['outcome'] {
  return { outcome: 'selected', optionId: option.optionId };
}
