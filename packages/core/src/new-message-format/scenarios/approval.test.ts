import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { createActionAgent, drainRun, expectStorageInvariant, useActionAimock } from '../test-utils/aimock';

describe('action-native approvals (aimock)', () => {
  const getMock = useActionAimock();

  it('asks for approval only when the requireApproval function says so', async () => {
    const llm = getMock();
    const executed: string[] = [];
    const remove = createTool({
      id: 'remove',
      description: 'Remove a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: async ({ path }, ctx) => path.startsWith('/protected') || ctx?.requestContext?.strict === true,
      execute: async ({ path }) => {
        executed.push(path);
        return { removed: path };
      },
    });
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'safe', name: 'remove', arguments: { path: '/tmp/a' } },
          { id: 'guarded', name: 'remove', arguments: { path: '/protected/b' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });

    const { agent, memory } = createActionAgent(llm, { tools: { remove } });
    const output = await agent.stream('clean up', { memory: { thread: 't-cond', resource: 'u' } });
    const first = await drainRun(output, memory, 't-cond');
    expectStorageInvariant(first);

    const requested = first.streamed.filter(a => a.type === 'tool-approval-requested');
    expect(requested.map(a => a.toolCallId)).toEqual(['guarded']);
    expect(executed).toEqual(['/tmp/a']);

    const resumed = await drainRun(
      await agent.approveToolCall({
        runId: first.runId,
        toolCallId: 'guarded',
        memory: { thread: 't-cond', resource: 'u' },
      }),
      memory,
      't-cond',
    );
    expect(executed).toEqual(['/tmp/a', '/protected/b']);
    expect(resumed.streamed.some(a => a.type === 'text' && a.role === 'assistant' && a.text === 'Done.')).toBe(true);

    // The same call with a strict request context needs approval too.
    llm.resetMatchCounts();
    const ctx = new RequestContext();
    ctx.set('strict', true);
    const strict = await drainRun(
      await agent.stream('clean again', { memory: { thread: 't-strict', resource: 'u' }, requestContext: ctx }),
      memory,
      't-strict',
    );
    expect(strict.streamed.filter(a => a.type === 'tool-approval-requested')).toHaveLength(2);
  });

  it('resolves two concurrent approvals independently', async () => {
    const llm = getMock();
    const executed: string[] = [];
    const send = createTool({
      id: 'send',
      description: 'Send an email',
      inputSchema: z.object({ to: z.string() }),
      requireApproval: true,
      execute: async ({ to }) => {
        executed.push(to);
        return { sent: to };
      },
    });
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'e1', name: 'send', arguments: { to: 'ann' } },
          { id: 'e2', name: 'send', arguments: { to: 'ben' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Handled.' });

    const { agent, memory } = createActionAgent(llm, { tools: { send } });
    const thread = { thread: 't-conc', resource: 'u' };
    const first = await drainRun(await agent.stream('email both', { memory: thread }), memory, 't-conc');
    expect(first.streamed.filter(a => a.type === 'tool-approval-requested')).toHaveLength(2);
    expect(executed).toEqual([]);

    const approved = await drainRun(
      await agent.approveToolCall({ runId: first.runId, toolCallId: 'e1', memory: thread }),
      memory,
      't-conc',
    );
    // e2 is still pending, so the run waits instead of calling the model.
    expect(approved.types).toEqual(['tool-approval-responded']);
    expect(llm.getRequests()).toHaveLength(1);

    const declined = await drainRun(
      await agent.declineToolCall({ runId: first.runId, toolCallId: 'e2', memory: thread }),
      memory,
      't-conc',
    );
    expect(declined.streamed.some(a => a.type === 'error')).toBe(false);
    expect(declined.types.at(-1)).toBe('run-end');

    expect(executed).toEqual(['ann']);
    const stored = await memory.listActions({ threadId: 't-conc' });
    const byCall = (id: string) => stored.filter(a => 'toolCallId' in a && a.toolCallId === id).map(a => a.type);
    expect(byCall('e1')).toContain('tool-result');
    expect(byCall('e2')).toContain('tool-denied');
    expect(byCall('e2')).not.toContain('tool-result');
  });
});
