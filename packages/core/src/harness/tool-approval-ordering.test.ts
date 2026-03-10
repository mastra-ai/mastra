import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../agent';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    toolCategoryResolver: toolName => (toolName === 'write_file' ? 'edit' : null),
  });
}

function approvalChunk() {
  return {
    type: 'tool-call-approval',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      toolCallId: 'call-1',
      toolName: 'write_file',
      args: { path: 'test.txt' },
    },
  };
}

describe('Harness tool approval ordering', () => {
  it('waits for the source stream to finish suspending before auto-approving granted categories', async () => {
    const harness = createHarness();
    harness.grantSessionCategory({ category: 'edit' });

    let sourceStreamFinished = false;
    const handleToolApprove = vi.fn(async () => {
      expect(sourceStreamFinished).toBe(true);
      return {
        message: {
          id: 'approved-message',
          role: 'assistant' as const,
          content: [],
          createdAt: new Date(),
        },
      };
    });

    (harness as any).handleToolApprove = handleToolApprove;

    await (harness as any).processStream(
      {
        fullStream: (async function* () {
          yield approvalChunk();
          await Promise.resolve();
          sourceStreamFinished = true;
        })(),
      },
      new RequestContext(),
    );

    expect(handleToolApprove).toHaveBeenCalledTimes(1);
  });

  it('waits for the source stream to finish suspending before applying immediate manual approvals', async () => {
    const harness = createHarness();

    let sourceStreamFinished = false;
    const handleToolApprove = vi.fn(async () => {
      expect(sourceStreamFinished).toBe(true);
      return {
        message: {
          id: 'approved-message',
          role: 'assistant' as const,
          content: [],
          createdAt: new Date(),
        },
      };
    });

    (harness as any).handleToolApprove = handleToolApprove;
    harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'tool_approval_required') {
        queueMicrotask(() => {
          harness.respondToToolApproval({ decision: 'approve' });
        });
      }
    });

    await (harness as any).processStream(
      {
        fullStream: (async function* () {
          yield approvalChunk();
          await Promise.resolve();
          sourceStreamFinished = true;
        })(),
      },
      new RequestContext(),
    );

    expect(handleToolApprove).toHaveBeenCalledTimes(1);
  });
});
