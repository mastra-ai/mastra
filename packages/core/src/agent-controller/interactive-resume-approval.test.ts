/**
 * Answering an interactive tool (`ask_user`) delivers the answer to that call
 * without an approval re-check, but it must not lift approval for the rest of
 * the resumed turn: a tool the model calls afterward still waits for approval.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** Streams one tool call, or a final text reply when no call is given. */
function turn(call?: { id: string; toolName: string; input: string }) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      if (call) {
        controller.enqueue({ type: 'tool-call', toolCallId: call.id, toolName: call.toolName, input: call.input });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
      } else {
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Done.' });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      }
      controller.close();
    },
  });
}

describe('interactive tool resume', () => {
  it('keeps the approval gate for other tools after the user answers ask_user', async () => {
    const execute = vi.fn(async () => 'deleted');
    const deleteEverything = createTool({
      id: 'delete_everything',
      description: 'Deletes everything.',
      inputSchema: z.object({}),
      execute,
    });
    let calls = 0;
    const agent = new Agent({
      id: 'interactive-agent',
      name: 'Interactive Agent',
      instructions: 'You are a helpful assistant.',
      tools: { delete_everything: deleteEverything },
      model: new MastraLanguageModelV2Mock({
        doStream: async () => {
          calls++;
          if (calls === 1) return { stream: turn({ id: 'ask-1', toolName: 'ask_user', input: '{"question":"Go?"}' }) };
          if (calls === 2) return { stream: turn({ id: 'delete-1', toolName: 'delete_everything', input: '{}' }) };
          return { stream: turn() };
        },
      }),
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'interactive-controller',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'interactive-session', ownerId: 'owner' });
    await session.thread.create();

    const events: AgentControllerEvent[] = [];
    const waiters: Array<() => void> = [];
    session.subscribe(event => {
      events.push(event);
      for (const wake of waiters.splice(0)) wake();
    });
    const waitFor = async (match: (event: AgentControllerEvent) => boolean, from = 0) => {
      while (!events.slice(from).some(match)) await new Promise<void>(resolve => waiters.push(resolve));
    };
    const approvalFor = (toolCallId: string) => (event: AgentControllerEvent) =>
      event.type === 'tool_approval_required' && event.toolCallId === toolCallId;

    void session.sendMessage({ content: 'Clean up' });
    await waitFor(approvalFor('ask-1'));
    session.respondToToolApproval({ decision: 'approve', toolCallId: 'ask-1' });
    await waitFor(event => event.type === 'tool_suspended' && event.toolCallId === 'ask-1');

    const resumedAt = events.length;
    void session.respondToToolSuspension({ toolCallId: 'ask-1', resumeData: 'yes' });
    await waitFor(
      event => approvalFor('delete-1')(event) || (event.type === 'tool_end' && event.toolCallId === 'delete-1'),
      resumedAt,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(events.slice(resumedAt).some(approvalFor('delete-1'))).toBe(true);
    expect(events.slice(resumedAt)).toContainEqual(
      expect.objectContaining({
        type: 'tool_end',
        toolCallId: 'ask-1',
        result: { content: 'User answered: yes', isError: false },
      }),
    );
    const declinedAt = events.length;
    session.respondToToolApproval({ decision: 'decline', toolCallId: 'delete-1' });
    await waitFor(event => event.type === 'agent_end', declinedAt);
    expect(execute).not.toHaveBeenCalled();
  });
});
