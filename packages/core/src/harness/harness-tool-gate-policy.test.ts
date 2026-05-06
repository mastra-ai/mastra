import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import type { ToolGatePolicy } from '../tools/tool-gate';
import { Harness } from './harness';
import type { PermissionRules } from './types';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createMockStreamResponse() {
  const chunks: any[] = [
    { type: 'text-start', payload: { id: 'msg-1' } },
    { type: 'text-delta', payload: { id: 'msg-1', text: 'Hello' } },
    { type: 'text-end', payload: { id: 'msg-1' } },
    { type: 'step-end', payload: {} },
    { type: 'finish', payload: {} },
  ];

  return {
    fullStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

describe('Harness tool gate policy', () => {
  let agent: Agent;
  let harness: Harness<{
    permissionRules?: PermissionRules;
    yolo?: boolean;
  }>;

  beforeEach(() => {
    agent = createAgent();
    harness = new Harness({
      id: 'test-harness',
      storage: new InMemoryStore(),
      initialState: {
        permissionRules: {
          categories: { edit: 'ask', execute: 'deny' },
          tools: {
            dangerousTool: 'deny',
            reviewedTool: 'ask',
            allowedTool: 'allow',
            allowedButCategoryDeniedTool: 'allow',
            stableDeleteTool: 'deny',
          },
        },
        yolo: false,
      },
      toolCategoryResolver: toolName => {
        if (toolName === 'categoryTool') return 'edit';
        if (toolName === 'categoryDeniedTool' || toolName === 'allowedButCategoryDeniedTool') return 'execute';
        return null;
      },
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    vi.spyOn(agent, 'stream').mockResolvedValue(createMockStreamResponse() as any);
    (harness as any).currentThreadId = 'test-thread-123';
  });

  it('passes Harness permission rules to the agent as a tool gate policy', async () => {
    await harness.sendMessage({ content: 'hello' });

    const streamSpy = vi.mocked(agent.stream);
    const [, streamOptions] = streamSpy.mock.calls[0]!;
    const policy = streamOptions.toolGatePolicy as ToolGatePolicy;

    expect(streamOptions.requireToolApproval).toBe(false);
    expect(policy.id).toBe('harness:test-harness:tool-permissions');
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'model-input',
            toolName: 'dangerousTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({
      effect: 'deny',
      metadata: {
        harnessId: 'test-harness',
        modeId: 'default',
      },
    });
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'tool-call',
            toolName: 'reviewedTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'requireApproval' });
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'model-input',
            toolName: 'allowedTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'allow' });
  });

  it('uses model-facing names and stable tool ids when resolving permission rules', async () => {
    await harness.sendMessage({ content: 'hello' });

    const streamSpy = vi.mocked(agent.stream);
    const [, streamOptions] = streamSpy.mock.calls[0]!;
    const policy = streamOptions.toolGatePolicy as ToolGatePolicy;

    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'model-input',
            toolName: 'delete',
            toolId: 'stableDeleteTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'deny' });
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'model-input',
            toolName: 'categoryDeniedTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'deny' });
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'model-input',
            toolName: 'allowedButCategoryDeniedTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'deny' });
  });

  it('does not let yolo or session grants override explicit deny', async () => {
    (harness as any).state.yolo = true;
    harness.grantSessionTool({ toolName: 'dangerousTool' });

    await harness.sendMessage({ content: 'hello' });

    const streamSpy = vi.mocked(agent.stream);
    const [, streamOptions] = streamSpy.mock.calls[0]!;
    const policy = streamOptions.toolGatePolicy as ToolGatePolicy;

    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'tool-call',
            toolName: 'dangerousTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'deny' });
    await expect(
      Promise.resolve(
        policy.evaluate({
          subject: {
            boundary: 'tool-call',
            toolName: 'categoryDeniedTool',
            source: { source: 'assigned' },
          },
        }),
      ),
    ).resolves.toMatchObject({ effect: 'deny' });
  });

  it('passes the same policy into approval and resume paths', async () => {
    const approveSpy = vi.spyOn(agent, 'approveToolCall').mockResolvedValue(createMockStreamResponse() as any);
    const declineSpy = vi.spyOn(agent, 'declineToolCall').mockResolvedValue(createMockStreamResponse() as any);
    const resumeSpy = vi.spyOn(agent, 'resumeStream').mockResolvedValue(createMockStreamResponse() as any);

    (harness as any).currentRunId = 'run-1';
    await (harness as any).handleToolApprove({ toolCallId: 'call-1' });
    await (harness as any).handleToolDecline({ toolCallId: 'call-1' });

    (harness as any).pendingSuspensionRunId = 'run-1';
    (harness as any).pendingSuspensionToolCallId = 'call-1';
    await (harness as any).handleToolResume({ resumeData: { approved: true } });

    expect(approveSpy.mock.calls[0]![0]).toMatchObject({
      requireToolApproval: false,
      toolGatePolicy: expect.objectContaining({ id: 'harness:test-harness:tool-permissions' }),
    });
    expect(declineSpy.mock.calls[0]![0]).toMatchObject({
      requireToolApproval: false,
      toolGatePolicy: expect.objectContaining({ id: 'harness:test-harness:tool-permissions' }),
    });
    expect(resumeSpy.mock.calls[0]![1]).toMatchObject({
      requireToolApproval: false,
      toolGatePolicy: expect.objectContaining({ id: 'harness:test-harness:tool-permissions' }),
    });
  });
});
