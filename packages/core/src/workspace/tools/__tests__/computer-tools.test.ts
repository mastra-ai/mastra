/**
 * Workspace Computer (Desktop) Tools Tests
 *
 * Tests the `mastra_workspace_computer_*` tools: factory gating on the
 * sandbox `computer` capability, delegation to the capability, media
 * (screenshot) output with size caps, post-action screenshots, and
 * approval config resolution.
 */

import { describe, it, expect, vi } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { Workspace } from '../../workspace';
import { computerScreenshotTool } from '../computer-screenshot';
import { isMediaToolResult, mediaToModelOutput } from '../media';
import { createWorkspaceTools } from '../tools';
import type { WorkspaceToolsConfig } from '../types';

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ALL_COMPUTER_TOOL_NAMES = Object.values(WORKSPACE_TOOLS.COMPUTER);

/** Create a mock SandboxComputer backed by vi.fn()s. */
function createMockComputer(overrides: Record<string, any> = {}) {
  return {
    screenshot: vi.fn().mockResolvedValue({ data: PNG_BYTES, mediaType: 'image/png' }),
    leftClick: vi.fn().mockResolvedValue(undefined),
    rightClick: vi.fn().mockResolvedValue(undefined),
    doubleClick: vi.fn().mockResolvedValue(undefined),
    moveMouse: vi.fn().mockResolvedValue(undefined),
    drag: vi.fn().mockResolvedValue(undefined),
    scroll: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    getScreenSize: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
    getCursorPosition: vi.fn().mockResolvedValue({ x: 12, y: 34 }),
    ...overrides,
  };
}

/** Create a mock sandbox, optionally with the computer capability. */
function createMockSandbox(opts: { computer?: any } = {}) {
  const sandbox: any = {
    id: 'test-sandbox',
    name: 'Test Sandbox',
    provider: 'test',
    status: 'running',
    getInfo: vi.fn().mockResolvedValue({
      id: 'test-sandbox',
      name: 'Test Sandbox',
      provider: 'test',
      status: 'running',
      createdAt: new Date(),
    }),
    executeCommand: vi.fn(),
  };
  if (opts.computer) {
    sandbox.computer = opts.computer;
  }
  return sandbox;
}

/**
 * Create a workspace with the mock sandbox + the emitted workspace tools.
 * `screenshotDelayMs: 0` is applied to all computer tools so tests don't sleep.
 */
async function setup(computer: any, tools?: WorkspaceToolsConfig) {
  const toolsConfig: WorkspaceToolsConfig = { ...tools };
  for (const name of ALL_COMPUTER_TOOL_NAMES) {
    toolsConfig[name] = { screenshotDelayMs: 0, ...(tools?.[name] as object | undefined) };
  }
  const workspace = new Workspace({ sandbox: createMockSandbox({ computer }), tools: toolsConfig });
  const emitted = await createWorkspaceTools(workspace);
  return { workspace, emitted };
}

// ---------------------------------------------------------------------------
// Factory gating
// ---------------------------------------------------------------------------

describe('createWorkspaceTools computer gating', () => {
  it('emits all computer tools when the sandbox supports the capability', async () => {
    const workspace = new Workspace({ sandbox: createMockSandbox({ computer: createMockComputer() }) });
    const tools = await createWorkspaceTools(workspace);
    for (const name of ALL_COMPUTER_TOOL_NAMES) {
      expect(tools[name], `expected ${name} to be emitted`).toBeDefined();
    }
  });

  it('emits no computer tools when the sandbox lacks the capability', async () => {
    const workspace = new Workspace({ sandbox: createMockSandbox() });
    const tools = await createWorkspaceTools(workspace);
    for (const name of ALL_COMPUTER_TOOL_NAMES) {
      expect(tools[name], `expected ${name} to be absent`).toBeUndefined();
    }
    // Sandbox tools are still emitted
    expect(tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]).toBeDefined();
  });

  it('emits no computer tools when the computer capability is incomplete', async () => {
    const workspace = new Workspace({
      sandbox: createMockSandbox({ computer: createMockComputer({ drag: undefined }) }),
    });
    const tools = await createWorkspaceTools(workspace);
    for (const name of ALL_COMPUTER_TOOL_NAMES) {
      expect(tools[name], `expected ${name} to be absent`).toBeUndefined();
    }
  });

  it('emits no computer tools for dynamic sandbox resolvers', async () => {
    const workspace = new Workspace({
      sandbox: async () => createMockSandbox({ computer: createMockComputer() }),
    });
    const tools = await createWorkspaceTools(workspace);
    for (const name of ALL_COMPUTER_TOOL_NAMES) {
      expect(tools[name], `expected ${name} to be absent`).toBeUndefined();
    }
  });

  it('respects per-tool enabled config', async () => {
    const { emitted } = await setup(createMockComputer(), {
      [WORKSPACE_TOOLS.COMPUTER.TYPE]: { enabled: false },
    });
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.TYPE]).toBeUndefined();
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.SCREENSHOT]).toBeDefined();
  });

  it('resolves static requireApproval onto the emitted tool', async () => {
    const { emitted } = await setup(createMockComputer(), {
      [WORKSPACE_TOOLS.COMPUTER.CLICK]: { requireApproval: true },
    });
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.CLICK].requireApproval).toBe(true);
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.SCREENSHOT].requireApproval).toBe(false);
  });

  it('supports dynamic arg-aware requireApproval', async () => {
    const { emitted } = await setup(createMockComputer(), {
      [WORKSPACE_TOOLS.COMPUTER.TYPE]: {
        requireApproval: ({ args }) => (args.text as string).includes('rm -rf'),
      },
    });
    const tool = emitted[WORKSPACE_TOOLS.COMPUTER.TYPE];
    expect(tool.requireApproval).toBe(true);
    await expect(tool.needsApprovalFn({ text: 'hello' })).resolves.toBe(false);
    await expect(tool.needsApprovalFn({ text: 'rm -rf /' })).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Screenshot tool
// ---------------------------------------------------------------------------

describe('computer_screenshot tool', () => {
  it('returns a media result with base64 PNG data', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.SCREENSHOT].execute({}, { workspace });

    expect(isMediaToolResult(result)).toBe(true);
    if (isMediaToolResult(result)) {
      expect(result.mediaType).toBe('image/png');
      expect(result.data).toBe(Buffer.from(PNG_BYTES).toString('base64'));
      expect(result.text).toContain('Screenshot');
    }
    expect(computer.screenshot).toHaveBeenCalledTimes(1);
  });

  it('falls back to text when the screenshot exceeds maxMediaBytes', async () => {
    const { workspace, emitted } = await setup(createMockComputer(), {
      [WORKSPACE_TOOLS.COMPUTER.SCREENSHOT]: { maxMediaBytes: 4 },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.SCREENSHOT].execute({}, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('exceeds maxMediaBytes');
  });

  it('throws when the sandbox lacks the computer capability', async () => {
    const workspace = new Workspace({ sandbox: createMockSandbox() });
    await expect((computerScreenshotTool.execute as any)({}, { workspace })).rejects.toThrow(
      'Sandbox does not support computer',
    );
  });

  it('throws when the workspace has no sandbox', async () => {
    const workspace = new Workspace({ filesystem: { provider: 'test', readOnly: false } as any });
    await expect((computerScreenshotTool.execute as any)({}, { workspace })).rejects.toThrow(
      'Workspace does not have a sandbox configured',
    );
  });
});

// ---------------------------------------------------------------------------
// Action tools
// ---------------------------------------------------------------------------

describe('computer action tools', () => {
  it('click delegates to leftClick and attaches a post-action screenshot by default', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.CLICK].execute({ x: 5, y: 10 }, { workspace });

    expect(computer.leftClick).toHaveBeenCalledWith(5, 10);
    expect(isMediaToolResult(result)).toBe(true);
    if (isMediaToolResult(result)) {
      expect(result.text).toBe('Clicked at (5, 10)');
      expect(result.mediaType).toBe('image/png');
    }
    expect(computer.screenshot).toHaveBeenCalledTimes(1);
  });

  it('skips the post-action screenshot when screenshotAfterAction is false', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.CLICK]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.CLICK].execute({ x: 5, y: 10 }, { workspace });

    expect(result).toBe('Clicked at (5, 10)');
    expect(computer.screenshot).not.toHaveBeenCalled();
  });

  it('does not fail the action when the post-action screenshot fails', async () => {
    const computer = createMockComputer({
      screenshot: vi.fn().mockRejectedValue(new Error('display gone')),
    });
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.CLICK].execute({ x: 1, y: 2 }, { workspace });

    expect(result).toBe('Clicked at (1, 2) (post-action screenshot failed)');
  });

  it('caps the post-action screenshot via maxMediaBytes', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.CLICK]: { maxMediaBytes: 4 },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.CLICK].execute({ x: 1, y: 2 }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('Clicked at (1, 2)');
    expect(result).toContain('exceeds maxMediaBytes');
  });

  it('double_click and right_click delegate to the capability', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.DOUBLE_CLICK]: { screenshotAfterAction: false },
      [WORKSPACE_TOOLS.COMPUTER.RIGHT_CLICK]: { screenshotAfterAction: false },
    });

    await expect(emitted[WORKSPACE_TOOLS.COMPUTER.DOUBLE_CLICK].execute({ x: 3, y: 4 }, { workspace })).resolves.toBe(
      'Double-clicked at (3, 4)',
    );
    expect(computer.doubleClick).toHaveBeenCalledWith(3, 4);

    await expect(emitted[WORKSPACE_TOOLS.COMPUTER.RIGHT_CLICK].execute({ x: 7, y: 8 }, { workspace })).resolves.toBe(
      'Right-clicked at (7, 8)',
    );
    expect(computer.rightClick).toHaveBeenCalledWith(7, 8);
  });

  it('move_mouse delegates to moveMouse', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.MOVE_MOUSE]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.MOVE_MOUSE].execute({ x: 50, y: 60 }, { workspace });

    expect(computer.moveMouse).toHaveBeenCalledWith(50, 60);
    expect(result).toBe('Moved mouse to (50, 60)');
  });

  it('type delegates to type without echoing the text back', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.TYPE]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.TYPE].execute({ text: 'secret password' }, { workspace });

    expect(computer.type).toHaveBeenCalledWith('secret password');
    expect(result).toBe('Typed 15 characters');
  });

  it('press_key supports single keys and hotkey chords', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.PRESS_KEY]: { screenshotAfterAction: false },
    });
    const tool = emitted[WORKSPACE_TOOLS.COMPUTER.PRESS_KEY];

    await expect(tool.execute({ key: 'Enter' }, { workspace })).resolves.toBe('Pressed Enter');
    expect(computer.press).toHaveBeenCalledWith('Enter');

    await expect(tool.execute({ key: ['ctrl', 's'] }, { workspace })).resolves.toBe('Pressed ctrl+s');
    expect(computer.press).toHaveBeenCalledWith(['ctrl', 's']);
  });

  it('scroll defaults the amount to 3', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.SCROLL]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.SCROLL].execute({ direction: 'down' }, { workspace });

    expect(computer.scroll).toHaveBeenCalledWith('down', 3);
    expect(result).toBe('Scrolled down by 3');
  });

  it('drag maps flat coordinates to from/to positions', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.DRAG]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.DRAG].execute(
      { startX: 1, startY: 2, endX: 3, endY: 4 },
      { workspace },
    );

    expect(computer.drag).toHaveBeenCalledWith({ x: 1, y: 2 }, { x: 3, y: 4 });
    expect(result).toBe('Dragged from (1, 2) to (3, 4)');
  });

  it('wait sleeps then reports', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.WAIT]: { screenshotAfterAction: false },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.WAIT].execute({ seconds: 0.1 }, { workspace });
    expect(result).toBe('Waited 0.1s');
  });

  it('get_screen_info reports screen size and cursor position', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.GET_SCREEN_INFO].execute({}, { workspace });

    expect(result).toBe('Screen size: 1024x768\nCursor position: (12, 34)');
  });
});

// ---------------------------------------------------------------------------
// toModelOutput
// ---------------------------------------------------------------------------

describe('mediaToModelOutput', () => {
  it('surfaces media results as text + media parts', () => {
    const output = mediaToModelOutput({
      __workspaceMedia: true,
      text: 'Screenshot',
      mediaType: 'image/png',
      data: 'aGVsbG8=',
    });
    expect(output).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot' },
        { type: 'media', data: 'aGVsbG8=', mediaType: 'image/png' },
      ],
    });
  });

  it('returns undefined for plain string output', () => {
    expect(mediaToModelOutput('Clicked at (1, 2)')).toBeUndefined();
  });
});
