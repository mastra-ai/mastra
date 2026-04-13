import { describe, it, expect, vi } from 'vitest';

import { RequestContext } from '../../request-context';
import type { Workspace } from '../../workspace/workspace';
import { WorkspaceInstructionsProcessor } from './workspace-instructions';

// =============================================================================
// Mock Helpers
// =============================================================================

interface MockMessageList {
  addSystem: ReturnType<typeof vi.fn>;
}

function createMockMessageList(): MockMessageList {
  return {
    addSystem: vi.fn(),
  };
}

function createMockWorkspace(instructions: string | ((...args: any[]) => string)): Workspace {
  if (typeof instructions === 'function') {
    return {
      getInstructions: vi.fn(instructions),
    } as unknown as Workspace;
  }
  return {
    getInstructions: vi.fn().mockReturnValue(instructions),
  } as unknown as Workspace;
}

// =============================================================================
// Tests
// =============================================================================

describe('WorkspaceInstructionsProcessor', () => {
  it('should have correct id', () => {
    const workspace = createMockWorkspace('some instructions');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    expect(processor.id).toBe('workspace-instructions-processor');
  });

  it('should inject instructions as system message', async () => {
    const workspace = createMockWorkspace('Local filesystem at "/data". Local command execution.');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    const result = await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
    } as any);

    expect(messageList.addSystem).toHaveBeenCalledOnce();
    expect(messageList.addSystem).toHaveBeenCalledWith({
      role: 'system',
      content: 'Local filesystem at "/data". Local command execution.',
    });
    expect(result.messageList).toBe(messageList);
  });

  it('should not inject system message when instructions are empty', async () => {
    const workspace = createMockWorkspace('');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
    } as any);

    expect(messageList.addSystem).not.toHaveBeenCalled();
  });

  it('should inject system message even when instructions are whitespace-only', async () => {
    const workspace = createMockWorkspace('   ');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
    } as any);

    expect(messageList.addSystem).toHaveBeenCalledOnce();
  });

  it('should call getInstructions on each processInputStep', async () => {
    const workspace = createMockWorkspace('instructions');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
    } as any);

    expect(workspace.getInstructions).toHaveBeenCalledOnce();
  });

  it('should pass requestContext through to workspace.getInstructions', async () => {
    const ctx = new RequestContext([['locale', 'en']]);

    const workspace = createMockWorkspace('instructions');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
      requestContext: ctx,
    } as any);

    expect(workspace.getInstructions).toHaveBeenCalledWith({ requestContext: ctx });
  });

  it('should pass undefined requestContext when not provided', async () => {
    const workspace = createMockWorkspace('instructions');
    const processor = new WorkspaceInstructionsProcessor({ workspace });

    const messageList = createMockMessageList();
    await processor.processInputStep({
      messageList: messageList as any,
      stepNumber: 0,
      steps: [],
      systemMessages: [],
      state: {},
      model: {} as any,
      tools: {},
    } as any);

    expect(workspace.getInstructions).toHaveBeenCalledWith({ requestContext: undefined });
  });
});
