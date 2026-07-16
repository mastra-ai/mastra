import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const spawn = vi.fn();
  const ndJsonStream = vi.fn(() => ({ readable: {}, writable: {} }));
  const connectionInstances: MockClientSideConnection[] = [];
  let onPrompt: ((connection: MockClientSideConnection) => Promise<void> | void) | undefined;
  let onInitialize: (() => Promise<unknown>) | undefined;
  let sessionResponse: Record<string, unknown> = { sessionId: 'session-1' };

  class MockClientSideConnection {
    client: any;
    initialize = vi.fn().mockImplementation(() => (onInitialize ? onInitialize() : Promise.resolve({})));
    authenticate = vi.fn().mockResolvedValue({});
    newSession = vi.fn().mockImplementation(() => Promise.resolve(sessionResponse));
    cancel = vi.fn().mockResolvedValue({});
    unstable_setSessionModel = vi.fn().mockResolvedValue({});
    prompt = vi.fn(async () => {
      await onPrompt?.(this);
      return { stopReason: 'end_turn' };
    });

    constructor(toClient: () => any) {
      this.client = toClient();
      connectionInstances.push(this);
    }
  }

  return {
    spawn,
    ndJsonStream,
    connectionInstances,
    MockClientSideConnection,
    get onPrompt() {
      return onPrompt;
    },
    set onPrompt(value: ((connection: MockClientSideConnection) => Promise<void> | void) | undefined) {
      onPrompt = value;
    },
    get onInitialize() {
      return onInitialize;
    },
    set onInitialize(value: (() => Promise<unknown>) | undefined) {
      onInitialize = value;
    },
    get sessionResponse() {
      return sessionResponse;
    },
    set sessionResponse(value: Record<string, unknown>) {
      sessionResponse = value;
    },
  };
});

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    spawn: mocks.spawn,
  };
});

vi.mock('@agentclientprotocol/sdk', async importOriginal => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    ClientSideConnection: mocks.MockClientSideConnection,
    ndJsonStream: mocks.ndJsonStream,
    PROTOCOL_VERSION: 1,
  };
});

function createProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
  };
  process.stdin = new PassThrough();
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.killed = false;
  process.kill = vi.fn(() => {
    process.killed = true;
    return true;
  });
  return process;
}

describe('createACPTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
    mocks.onInitialize = undefined;
    mocks.sessionResponse = { sessionId: 'session-1' };
    mocks.spawn.mockImplementation(() => createProcess());
  });

  it('creates a Mastra tool with ACP input and output schemas', async () => {
    const { createACPTool } = await import('../tool');

    const tool = createACPTool({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude-agent-acp',
      args: [],
    });

    expect(tool.id).toBe('claude-code');
    expect(tool.description).toBe('Build anything with Claude Code');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect((tool.inputSchema as any).safeParse({ task: 'build it' }).success).toBe(true);
    expect((tool.outputSchema as any).safeParse({ output: 'done' }).success).toBe(true);
  });

  it('sends the task to the ACP connection when executed', async () => {
    const { createACPTool } = await import('../tool');

    const tool = createACPTool({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude-agent-acp',
      args: [],
      persistSession: true,
    });

    const result = await tool.execute?.({ task: 'write tests' } as any, {} as any);
    const connection = mocks.connectionInstances[0];

    expect(mocks.spawn).toHaveBeenCalledWith(
      'claude-agent-acp',
      [],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
    );
    expect(connection?.prompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'write tests' }],
    });
    expect(result).toEqual({ output: '' });
  });

  it('reuses one ACP session across executions by default', async () => {
    const { createACPTool } = await import('../tool');

    const tool = createACPTool({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude-agent-acp',
      args: [],
    });

    await tool.execute?.({ task: 'write tests' } as any, {} as any);
    await tool.execute?.({ task: 'fix lint' } as any, {} as any);

    expect(mocks.connectionInstances).toHaveLength(1);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.connectionInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(mocks.connectionInstances[0]?.prompt).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'write tests' }],
    });
    expect(mocks.connectionInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'fix lint' }],
    });
  });

  it('creates and disconnects a fresh ACP connection when persistSession is false', async () => {
    const { createACPTool } = await import('../tool');

    const tool = createACPTool({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude-agent-acp',
      args: [],
      persistSession: false,
    });

    await tool.execute?.({ task: 'write tests' } as any, {} as any);
    await tool.execute?.({ task: 'fix lint' } as any, {} as any);

    expect(mocks.connectionInstances).toHaveLength(2);
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(mocks.connectionInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'write tests' }],
    });
    expect(mocks.connectionInstances[1]?.prompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'fix lint' }],
    });
    expect((mocks.spawn.mock.results[0]?.value as ReturnType<typeof createProcess>).kill).toHaveBeenCalledTimes(1);
    expect((mocks.spawn.mock.results[1]?.value as ReturnType<typeof createProcess>).kill).toHaveBeenCalledTimes(1);
  });

  it('uses the runtime Mastra workspace for ACP file access', async () => {
    const { createACPTool } = await import('../tool');
    const readFile = vi.fn().mockResolvedValue('from workspace');
    const workspace = { filesystem: { readFile } };
    const mastra = { getWorkspace: vi.fn().mockResolvedValue(workspace) };

    const tool = createACPTool({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude-agent-acp',
      args: [],
    });

    await tool.execute?.({ task: 'read file' } as any, { mastra } as any);

    await expect(mocks.connectionInstances[0]?.client.readTextFile({ path: 'src/index.ts' })).resolves.toEqual({
      content: 'from workspace',
    });
    expect(mastra.getWorkspace).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith('src/index.ts');
  });
});

describe('ACPConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
    mocks.onInitialize = undefined;
    mocks.sessionResponse = { sessionId: 'session-1' };
    mocks.spawn.mockImplementation(() => createProcess());
  });

  it('lazy initializes the ACP process on first prompt and collects agent message chunks', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      args: ['--acp'],
      persistSession: true,
    });

    expect(mocks.spawn).not.toHaveBeenCalled();

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello ' },
        },
      });
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'world' },
        },
      });
    };

    await expect(connection.prompt('implement feature')).resolves.toBe('hello world');
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });

  it('streams agent message chunks before the ACP prompt completes', async () => {
    const { ACPConnection } = await import('../connection');
    let finishPrompt!: () => void;

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello ' },
        },
      });

      await new Promise<void>(resolve => {
        finishPrompt = resolve;
      });

      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'world' },
        },
      });
    };

    const iterator = connection.promptStream('stream feature')[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      value: { type: 'text', text: 'hello ' },
      done: false,
    });
    finishPrompt();
    await expect(iterator.next()).resolves.toEqual({
      value: { type: 'text', text: 'world' },
      done: false,
    });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('cancels the ACP prompt when the abort signal fires', async () => {
    const { ACPConnection } = await import('../connection');
    const controller = new AbortController();

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    let resolvePrompt: (value: { stopReason: 'cancelled' }) => void;
    const promptPromise = new Promise<{ stopReason: 'cancelled' }>(resolve => {
      resolvePrompt = resolve;
    });

    const outputPromise = connection.prompt('stop me', controller.signal);
    const acpConnection = mocks.connectionInstances[0];
    acpConnection!.prompt.mockReturnValue(promptPromise);

    controller.abort(new Error('stop'));
    resolvePrompt!({ stopReason: 'cancelled' });

    await expect(outputPromise).rejects.toThrow('stop');
    expect(acpConnection?.cancel).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('auto-selects the first permission option', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    await connection.prompt('needs permission');
    const client = mocks.connectionInstances[0]?.client;

    await expect(
      client.requestPermission({
        sessionId: 'session-1',
        toolCallId: 'tool-1',
        options: [{ optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' }],
      }),
    ).resolves.toEqual({ outcome: { outcome: 'selected', optionId: 'allow_once' } });
  });

  it('uses the client returned by createClient and passes it the default client', async () => {
    const { ACPConnection } = await import('../connection');

    const extMethod = vi.fn().mockResolvedValue({ ok: true });
    const createClient = vi.fn((defaultClient: any) => Object.assign(defaultClient, { extMethod }));

    const connection = new ACPConnection({
      id: 'grok',
      description: 'Grok via ACP',
      command: 'grok',
      persistSession: true,
      createClient,
    });

    await connection.prompt('needs extension methods');
    const client = mocks.connectionInstances[0]?.client;

    expect(createClient).toHaveBeenCalledTimes(1);
    await expect(client.extMethod('_grok/ping', {})).resolves.toEqual({ ok: true });
    expect(extMethod).toHaveBeenCalledWith('_grok/ping', {});

    // default client behavior is preserved
    await expect(
      client.requestPermission({
        sessionId: 'session-1',
        toolCallId: 'tool-1',
        options: [{ optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' }],
      }),
    ).resolves.toEqual({ outcome: { outcome: 'selected', optionId: 'allow_once' } });
  });

  it('kills the agent process and rejects when createClient throws', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'grok',
      description: 'Grok via ACP',
      command: 'grok',
      persistSession: true,
      createClient: () => {
        throw new Error('bad client factory');
      },
    });

    await expect(connection.prompt('never runs')).rejects.toThrow('bad client factory');
    expect((mocks.spawn.mock.results[0]?.value as ReturnType<typeof createProcess>).kill).toHaveBeenCalledTimes(1);
  });

  it('uses the default client when createClient is omitted', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    await connection.prompt('no custom client');
    const client = mocks.connectionInstances[0]?.client;

    expect(client.extMethod).toBeUndefined();
    expect(typeof client.sessionUpdate).toBe('function');
  });

  it('rejects the prompt when the agent process fails to spawn', async () => {
    const { ACPConnection } = await import('../connection');

    mocks.onInitialize = () => new Promise(() => {});

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'definitely-not-a-real-command',
      persistSession: true,
    });

    const promptPromise = connection.prompt('never starts');
    const agentProcess = mocks.spawn.mock.results[0]?.value as ReturnType<typeof createProcess>;
    agentProcess.emit('error', new Error('spawn definitely-not-a-real-command ENOENT'));

    await expect(promptPromise).rejects.toThrow('spawn definitely-not-a-real-command ENOENT');
  });

  it('rejects the prompt when the agent process exits during initialization', async () => {
    const { ACPConnection } = await import('../connection');

    mocks.onInitialize = () => new Promise(() => {});

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const promptPromise = connection.prompt('exits early');
    const agentProcess = mocks.spawn.mock.results[0]?.value as ReturnType<typeof createProcess>;
    agentProcess.emit('exit', 1, null);

    await expect(promptPromise).rejects.toThrow(
      'ACP agent process exited during initialization (code: 1, signal: null)',
    );
  });

  it('delegates permission requests to onPermissionRequest callback', async () => {
    const { ACPConnection } = await import('../connection');

    const handler = vi.fn().mockResolvedValue({ outcome: { outcome: 'cancelled' } });

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
      onPermissionRequest: handler,
    });

    await connection.prompt('needs custom permission');
    const client = mocks.connectionInstances[0]?.client;

    const request = {
      sessionId: 'session-1',
      toolCallId: 'tool-1',
      options: [{ optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' }],
    };

    await expect(client.requestPermission(request)).resolves.toEqual({ outcome: { outcome: 'cancelled' } });
    expect(handler).toHaveBeenCalledWith(request);
  });

  it('calls unstable_setSessionModel when model option is provided', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      args: ['--acp'],
      model: 'claude-sonnet-4-20250514',
      persistSession: true,
    });

    await connection.prompt('implement feature');
    const acpConnection = mocks.connectionInstances[0];

    expect(acpConnection?.unstable_setSessionModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      modelId: 'claude-sonnet-4-20250514',
    });
  });

  it('does not call unstable_setSessionModel when model option is omitted', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    await connection.prompt('implement feature');
    const acpConnection = mocks.connectionInstances[0];

    expect(acpConnection?.unstable_setSessionModel).not.toHaveBeenCalled();
  });

  it('returns available models from the session response', async () => {
    const { ACPConnection } = await import('../connection');
    const availableModels = [
      { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet' },
      { modelId: 'claude-haiku-4-20250514', name: 'Claude Haiku' },
    ];

    mocks.sessionResponse = {
      sessionId: 'session-1',
      models: { availableModels, currentModelId: 'claude-sonnet-4-20250514' },
    };

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const models = await connection.getAvailableModels();
    expect(models).toEqual(availableModels);
  });

  it('returns empty array when session has no models', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const models = await connection.getAvailableModels();
    expect(models).toEqual([]);
  });

  it('throws when model option does not match available models', async () => {
    const { ACPConnection } = await import('../connection');

    mocks.sessionResponse = {
      sessionId: 'session-1',
      models: {
        availableModels: [
          { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet' },
          { modelId: 'claude-haiku-4-20250514', name: 'Claude Haiku' },
        ],
        currentModelId: 'claude-sonnet-4-20250514',
      },
    };

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      model: 'nonexistent-model',
      persistSession: true,
    });

    await expect(connection.prompt('implement feature')).rejects.toThrow(
      'Model "nonexistent-model" is not available. Available models: claude-sonnet-4-20250514, claude-haiku-4-20250514',
    );
  });

  it('skips validation when session does not expose available models', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      model: 'any-model-id',
      persistSession: true,
    });

    await connection.prompt('implement feature');
    const acpConnection = mocks.connectionInstances[0];

    expect(acpConnection?.unstable_setSessionModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      modelId: 'any-model-id',
    });
  });

  it('setModel calls unstable_setSessionModel with the given model ID', async () => {
    const { ACPConnection } = await import('../connection');

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    await connection.setModel('claude-sonnet-4-20250514');
    const acpConnection = mocks.connectionInstances[0];

    expect(acpConnection?.unstable_setSessionModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      modelId: 'claude-sonnet-4-20250514',
    });
  });

  it('setModel throws when model does not match available models', async () => {
    const { ACPConnection } = await import('../connection');

    mocks.sessionResponse = {
      sessionId: 'session-1',
      models: {
        availableModels: [{ modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet' }],
        currentModelId: 'claude-sonnet-4-20250514',
      },
    };

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    await expect(connection.setModel('nonexistent')).rejects.toThrow(
      'Model "nonexistent" is not available. Available models: claude-sonnet-4-20250514',
    );
  });

  it('throws when available models is an empty array', async () => {
    const { ACPConnection } = await import('../connection');

    mocks.sessionResponse = {
      sessionId: 'session-1',
      models: { availableModels: [], currentModelId: undefined },
    };

    const connection = new ACPConnection({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      model: 'any-model',
      persistSession: true,
    });

    await expect(connection.prompt('implement feature')).rejects.toThrow(
      'Model "any-model" is not available. Available models: (none)',
    );
  });
});

describe('AcpAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
    mocks.onInitialize = undefined;
    mocks.sessionResponse = { sessionId: 'session-1' };
    mocks.spawn.mockImplementation(() => createProcess());
  });

  it('generates a response through the ACP connection', async () => {
    const { AcpAgent } = await import('../agent');

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'done' },
        },
      });
    };

    const agent = new AcpAgent({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const result = await agent.generate('write tests', { instructions: 'Be concise', runId: 'run-1' });

    expect(result.text).toBe('done');
    expect(result.runId).toBe('run-1');
    expect(result.response?.dbMessages?.[0]?.role).toBe('assistant');
    expect(mocks.connectionInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'Be concise\n\nwrite tests' }],
    });
  });

  it('streams ACP output as agent chunks', async () => {
    const { AcpAgent } = await import('../agent');

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'streamed ' },
        },
      });
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'output' },
        },
      });
    };

    const agent = new AcpAgent({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const onFinish = vi.fn();
    const result = await agent.stream('stream it', { runId: 'run-2', onFinish });
    const chunks = [];
    for await (const chunk of result.fullStream as any) {
      chunks.push(chunk);
    }

    await expect(result.text).resolves.toBe('streamed output');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ text: 'streamed output', runId: 'run-2' }));
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
    expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text)).toEqual([
      'streamed ',
      'output',
    ]);
    expect(result.messageList.get.response.db()[0]?.role).toBe('assistant');
  });

  it('emits tool call session updates as Mastra tool chunks', async () => {
    const { AcpAgent } = await import('../agent');

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          title: 'Read file',
          kind: 'read',
          status: 'in_progress',
          rawInput: { path: 'src/index.ts' },
          locations: [{ path: 'src/index.ts', line: 10 }],
        },
      });
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'completed',
          rawOutput: { content: 'export const value = 1;' },
        },
      });
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'result' },
        },
      });
    };

    const agent = new AcpAgent({
      id: 'claude-code',
      description: 'Build anything with Claude Code',
      command: 'claude',
      persistSession: true,
    });

    const result = await agent.stream('read file', { runId: 'run-3' });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    await expect(result.text).resolves.toBe('result');

    const toolCallChunk = chunks.find(c => c.type === 'tool-call');
    expect(toolCallChunk).toMatchObject({
      type: 'tool-call',
      from: 'AGENT',
      runId: 'run-3',
      payload: {
        toolCallId: 'tc-1',
        toolName: 'Read file',
        args: { path: 'src/index.ts' },
      },
    });

    const toolResultChunk = chunks.find(c => c.type === 'tool-result');
    expect(toolResultChunk).toMatchObject({
      type: 'tool-result',
      from: 'AGENT',
      runId: 'run-3',
      payload: {
        toolCallId: 'tc-1',
        toolName: 'Read file',
        result: { content: 'export const value = 1;' },
        isError: false,
      },
    });

    expect(chunks.some(c => c.type === 'data-acp-session-update')).toBe(false);

    const textDeltas = chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);
    expect(textDeltas).toEqual(['result']);
  });

  it('can be delegated to by a supervisor agent', async () => {
    const { AcpAgent } = await import('../agent');

    mocks.onPrompt = async acpConnection => {
      await acpConnection.client.sessionUpdate({
        sessionId: 'session-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'delegated result' },
        },
      });
    };

    let callCount = 0;
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate coding work.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              text: '',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'agent-claudeCode',
                  input: JSON.stringify({ prompt: 'fix the bug' }),
                },
              ],
              warnings: [],
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            text: 'supervisor done',
            content: [{ type: 'text', text: 'supervisor done' }],
            warnings: [],
          };
        },
      }),
      agents: {
        claudeCode: new AcpAgent({
          id: 'claude-code',
          description: 'Build anything with Claude Code',
          command: 'claude',
          persistSession: true,
        }),
      },
    });

    const result = await supervisor.generate('delegate this', { maxSteps: 3 });

    expect(result.text).toBe('supervisor done');
    expect(mocks.connectionInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: [{ type: 'text', text: 'fix the bug' }],
    });
  });
});
