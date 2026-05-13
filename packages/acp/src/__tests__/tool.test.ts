import { PassThrough } from 'node:stream';

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const spawn = vi.fn();
  const ndJsonStream = vi.fn(() => ({ readable: {}, writable: {} }));
  const connectionInstances: MockClientSideConnection[] = [];
  let onPrompt: ((connection: MockClientSideConnection) => Promise<void> | void) | undefined;

  class MockClientSideConnection {
    client: any;
    initialize = vi.fn().mockResolvedValue({});
    authenticate = vi.fn().mockResolvedValue({});
    newSession = vi.fn().mockResolvedValue({ sessionId: 'session-1' });
    cancel = vi.fn().mockResolvedValue({});
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
  return {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    killed: false,
    kill: vi.fn(function (this: { killed: boolean }) {
      this.killed = true;
      return true;
    }),
  };
}

describe('createACPTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
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
});

describe('ACPConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
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
});

describe('AcpAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectionInstances.length = 0;
    mocks.onPrompt = undefined;
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

    const result = await agent.stream('stream it', { runId: 'run-2' });
    const chunks = [];
    for await (const chunk of result.fullStream as any) {
      chunks.push(chunk);
    }

    await expect(result.text).resolves.toBe('streamed output');
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
});
