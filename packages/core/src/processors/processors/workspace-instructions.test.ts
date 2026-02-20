import { describe, it, expect, vi } from 'vitest';

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

function createMockWorkspace(instructions: string): Workspace {
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
});
