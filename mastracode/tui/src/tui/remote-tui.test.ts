import { describe, expect, it, vi } from 'vitest';

import { RemoteMastraTUI } from './remote-tui.js';

async function* lines(values: string[]) {
  for (const value of values) yield value;
}

describe('RemoteMastraTUI', () => {
  it('runs chat through the remote backend and capability-gates local commands', async () => {
    const output: string[] = [];
    const backend = {
      capabilities: { localControlPlane: false },
      start: vi.fn(async ({ onSnapshot }: any) => {
        onSnapshot({ threadId: 'thread-1', modeId: 'build', modelId: 'model-1', messages: [] });
        return {
          snapshot: { threadId: 'thread-1', modeId: 'build', modelId: 'model-1', messages: [] },
          unsubscribe() {},
        };
      }),
      sendMessage: vi.fn(async () => {}),
    };
    const tui = new RemoteMastraTUI({
      backend: backend as never,
      input: lines(['hello', '/mcp', '/quit']),
      write: line => output.push(line),
    });

    await tui.run();

    expect(backend.sendMessage).toHaveBeenCalledWith('hello');
    expect(output).toContain('Connected: thread-1 · build · model-1');
    expect(output).toContain('/mcp requires embedded mcode.');
  });

  it('reports a command failure and keeps accepting input', async () => {
    const output: string[] = [];
    const backend = {
      capabilities: { localControlPlane: false },
      start: vi.fn(async () => ({
        snapshot: { threadId: 'thread-1', modeId: 'build', modelId: 'model-1', messages: [] },
        unsubscribe() {},
      })),
      switchThread: vi.fn(async () => {
        throw new Error('missing thread');
      }),
      sendMessage: vi.fn(async () => {}),
    };
    const tui = new RemoteMastraTUI({
      backend: backend as never,
      input: lines(['/switch bad', 'still here', '/quit']),
      write: line => output.push(line),
    });

    await tui.run();

    expect(output).toContain('Command error: missing thread');
    expect(backend.sendMessage).toHaveBeenCalledWith('still here');
  });
});
