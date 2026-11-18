import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../agent/message-list';
import { MessageList } from '../../../agent/message-list';
import { markAgentWorkflowTool } from '../../../tools/toolchecks';
import { commitToolResult, computeModelOutputProviderMetadata } from './tool-result-commit-core';

function makeMessageList() {
  const messageList = new MessageList();
  const message: MastraDBMessage = {
    id: 'message-1',
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'test-tool',
            args: {},
          },
        },
      ],
    },
    createdAt: new Date(),
  };
  messageList.add(message, 'response');
  return messageList;
}

describe('commitToolResult', () => {
  it.each([0, '', false])('preserves a falsy structured result on an error outcome: %j', result => {
    const messageList = makeMessageList();

    expect(
      commitToolResult({
        messageList,
        outcome: { kind: 'error', errorText: 'failed', result },
        toolCallId: 'call-1',
        toolName: 'test-tool',
        toolArgs: {},
      }),
    ).toBe(true);

    const invocation = messageList.get.all.db()[0]?.content.parts?.[0];
    expect(invocation).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: { state: 'output-error', errorText: 'failed', result },
    });
  });
});

// Workflow tools can't define `toModelOutput`, so their results carry a
// `mastra.workflowTool` marker that tracing uses to show them (#30219).
describe('computeModelOutputProviderMetadata workflow tool marker', () => {
  const existingProviderMetadata = { mastra: { createdAt: 1 }, openai: { itemId: 'item-1' } };

  it('marks a result from an agent workflow tool and keeps existing metadata', async () => {
    const workflowTool = { toModelOutput: undefined };
    markAgentWorkflowTool(workflowTool);

    await expect(
      computeModelOutputProviderMetadata({
        tool: { ...workflowTool },
        toolName: 'workflow-weather',
        result: { result: { city: 'Paris' }, runId: 'run-1' },
        existingProviderMetadata,
      }),
    ).resolves.toEqual({ mastra: { createdAt: 1, workflowTool: true }, openai: { itemId: 'item-1' } });
  });

  it('marks a result that had no provider metadata', async () => {
    const workflowTool = {};
    markAgentWorkflowTool(workflowTool);

    await expect(
      computeModelOutputProviderMetadata({ tool: workflowTool, toolName: 'workflow-weather', result: { ok: true } }),
    ).resolves.toEqual({ mastra: { workflowTool: true } });
  });

  it('keeps a mapped modelOutput next to the marker', async () => {
    const workflowTool = { toModelOutput: () => 'mapped' };
    markAgentWorkflowTool(workflowTool);

    await expect(
      computeModelOutputProviderMetadata({ tool: workflowTool, toolName: 'workflow-weather', result: { ok: true } }),
    ).resolves.toEqual({ mastra: { modelOutput: 'mapped', workflowTool: true } });
  });

  it('adds no marker for another tool', async () => {
    await expect(
      computeModelOutputProviderMetadata({
        tool: {},
        toolName: 'workflow-lookalike',
        result: { ok: true },
        existingProviderMetadata,
      }),
    ).resolves.toEqual(existingProviderMetadata);
    await expect(
      computeModelOutputProviderMetadata({ tool: {}, toolName: 'getWeather', result: { ok: true } }),
    ).resolves.toBeUndefined();
  });
});
