/**
 * Workspace Computer (Desktop) Tools Tests
 *
 * Tests the `mastra_workspace_computer_*` tools: factory gating on the
 * sandbox `computer` capability, delegation to the capability, media
 * (screenshot) output with size caps, post-action screenshots, and
 * approval config resolution.
 */

import { describe, it, expect, vi } from 'vitest';

import { AccessibilityRefError } from '../..';
import { WORKSPACE_TOOLS } from '../../constants';
import type { AccessibilitySnapshot, ComputerAccessibility, SandboxComputer, WorkspaceSandbox } from '../../sandbox';
import { Workspace } from '../../workspace';
import { computerScreenshotTool } from '../computer-screenshot';
import { isMediaToolResult, mediaToModelOutput } from '../media';
import { createWorkspaceTools } from '../tools';
import type { WorkspaceToolsConfig } from '../types';

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ACCESSIBILITY_TOOL_NAMES = [
  WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE,
  WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT,
  WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT,
] as const;

/** The 11 pixel computer tools (every computer tool except the optional accessibility ones). */
const ALL_COMPUTER_TOOL_NAMES = Object.values(WORKSPACE_TOOLS.COMPUTER).filter(
  name => !(ACCESSIBILITY_TOOL_NAMES as readonly string[]).includes(name),
);

/** Create a mock SandboxComputer backed by vi.fn()s. */
function createMockComputer(overrides: Partial<SandboxComputer> = {}): SandboxComputer {
  return {
    screenshot: vi.fn(async () => ({ data: PNG_BYTES, mediaType: 'image/png' as const })),
    leftClick: vi.fn(async () => {}),
    rightClick: vi.fn(async () => {}),
    doubleClick: vi.fn(async () => {}),
    moveMouse: vi.fn(async () => {}),
    drag: vi.fn(async () => {}),
    scroll: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
    press: vi.fn(async () => {}),
    getScreenSize: vi.fn(async () => ({ width: 1024, height: 768 })),
    getCursorPosition: vi.fn(async () => ({ x: 12, y: 34 })),
    ...overrides,
  };
}

/** Create a mock sandbox, optionally with the computer capability. */
function createMockSandbox(opts: { computer?: SandboxComputer } = {}): WorkspaceSandbox {
  return {
    id: 'test-sandbox',
    name: 'Test Sandbox',
    provider: 'test',
    status: 'running',
    snapshot: vi.fn(async () => {}),
    getInfo: vi.fn(async () => ({
      id: 'test-sandbox',
      name: 'Test Sandbox',
      provider: 'test',
      status: 'running' as const,
      createdAt: new Date(),
    })),
    executeCommand: vi.fn(async () => ({
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      executionTimeMs: 0,
    })),
    ...(opts.computer ? { computer: opts.computer } : {}),
  };
}

/**
 * Create a workspace with the mock sandbox + the emitted workspace tools.
 * `screenshotDelayMs: 0` is applied to all computer tools so tests don't sleep.
 */
async function setup(computer: SandboxComputer, tools?: WorkspaceToolsConfig) {
  const toolsConfig: WorkspaceToolsConfig = { ...tools };
  for (const name of [...ALL_COMPUTER_TOOL_NAMES, ...ACCESSIBILITY_TOOL_NAMES]) {
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
    const incompleteComputer: unknown = { ...createMockComputer(), drag: undefined };
    const sandbox = createMockSandbox();
    (sandbox as { computer?: unknown }).computer = incompleteComputer;
    const workspace = new Workspace({ sandbox });
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

  it('press_key rejects empty key values before calling the capability', async () => {
    const computer = createMockComputer();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.PRESS_KEY]: { screenshotAfterAction: false },
    });
    const tool = emitted[WORKSPACE_TOOLS.COMPUTER.PRESS_KEY];

    for (const key of ['', [''], ['ctrl', '']]) {
      await expect(tool.execute({ key }, { workspace })).resolves.toMatchObject({ error: true });
    }
    expect(computer.press).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// Accessibility tools
// ---------------------------------------------------------------------------

const SNAPSHOT: AccessibilitySnapshot = {
  snapshotId: 's7',
  truncated: false,
  nodes: [
    { ref: 'g1.s7.0', role: 'application', name: 'desk', states: [], actions: [], depth: 0 },
    {
      ref: 'g1.s7.1',
      role: 'push button',
      name: 'Save "now"',
      states: ['enabled', 'focusable'],
      actions: ['click'],
      bounds: { x: 10, y: 20, width: 80, height: 30 },
      depth: 1,
    },
    { ref: 'g1.s7.2', role: 'text', name: 'Title', states: ['editable'], actions: [], value: 'hi', depth: 1 },
  ],
};

function createMockAccessibility(overrides: Partial<ComputerAccessibility> = {}): ComputerAccessibility {
  return {
    getTree: vi.fn(async () => SNAPSHOT),
    act: vi.fn(async () => {}),
    setText: vi.fn(async () => {}),
    ...overrides,
  };
}

function computerWithAccessibility(overrides: Partial<ComputerAccessibility> = {}) {
  const accessibility = createMockAccessibility(overrides);
  return { computer: createMockComputer({ accessibility }), accessibility };
}

describe('accessibility tool gating', () => {
  it('emits the three accessibility tools plus the 11 pixel tools when the part exists', async () => {
    const { computer } = computerWithAccessibility();
    const { emitted } = await setup(computer);
    for (const name of [...ALL_COMPUTER_TOOL_NAMES, ...ACCESSIBILITY_TOOL_NAMES]) {
      expect(emitted[name], `expected ${name} to be emitted`).toBeDefined();
    }
    expect(Object.keys(emitted).filter(k => k.startsWith('mastra_workspace_computer_'))).toHaveLength(14);
  });

  it('emits only the 11 pixel tools when the part is absent', async () => {
    const { emitted } = await setup(createMockComputer());
    for (const name of ACCESSIBILITY_TOOL_NAMES) {
      expect(emitted[name], `expected ${name} to be absent`).toBeUndefined();
    }
    expect(
      Object.keys(emitted)
        .filter(k => k.startsWith('mastra_workspace_computer_'))
        .sort(),
    ).toEqual([...ALL_COMPUTER_TOOL_NAMES].sort());
  });

  it('emits no accessibility tools when the part is incomplete', async () => {
    const accessibility = { ...createMockAccessibility(), setText: undefined } as unknown as ComputerAccessibility;
    const { emitted } = await setup(createMockComputer({ accessibility }));
    for (const name of ACCESSIBILITY_TOOL_NAMES) expect(emitted[name]).toBeUndefined();
  });

  it('emits no accessibility tools for dynamic sandbox resolvers', async () => {
    const { computer } = computerWithAccessibility();
    const workspace = new Workspace({ sandbox: async () => createMockSandbox({ computer }) });
    const tools = await createWorkspaceTools(workspace);
    for (const name of ACCESSIBILITY_TOOL_NAMES) expect(tools[name]).toBeUndefined();
  });

  it('respects per-tool enabled and requireApproval config', async () => {
    const { computer } = computerWithAccessibility();
    const { emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT]: { enabled: false },
      [WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT]: { requireApproval: true },
    });
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT]).toBeUndefined();
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].requireApproval).toBe(true);
    expect(emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE].requireApproval).toBe(false);
  });
});

describe('accessibility tools', () => {
  it('tree formats one indented line per node and passes app/maxNodes through', async () => {
    const { computer, accessibility } = computerWithAccessibility();
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE].execute(
      { app: 'desk', maxNodes: 50 },
      { workspace },
    );

    expect(accessibility.getTree).toHaveBeenCalledWith({ app: 'desk', maxDepth: 25, maxNodes: 50 });
    expect(result).toBe(
      [
        'snapshotId: s7',
        'g1.s7.0 application "desk"',
        '  g1.s7.1 push button "Save \\"now\\"" states=[enabled,focusable] actions=[click] bounds=10,20,80x30',
        '  g1.s7.2 text "Title" value="hi" states=[editable]',
      ].join('\n'),
    );
    expect(computer.screenshot).not.toHaveBeenCalled();
  });

  it('tree notes truncation and applies schema defaults', async () => {
    const { computer, accessibility } = computerWithAccessibility({
      getTree: vi.fn(async () => ({ ...SNAPSHOT, truncated: true })),
    });
    const { workspace, emitted } = await setup(computer);
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE].execute({}, { workspace });

    expect(accessibility.getTree).toHaveBeenCalledWith({ maxDepth: 25, maxNodes: 400 });
    expect(result).toContain('(truncated:');
  });

  it('act and set_text pass ref, action and text through unchanged without a screenshot', async () => {
    const { computer, accessibility } = computerWithAccessibility();
    const { workspace, emitted } = await setup(computer);
    const text = "quote ' $(x) `y`\nnon-ascii é";

    await expect(
      emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute({ ref: 'g1.s7.1', action: 'click' }, { workspace }),
    ).resolves.toBe('Performed click on g1.s7.1');
    await expect(
      emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT].execute({ ref: 'g1.s7.2', text }, { workspace }),
    ).resolves.toBe(`Set text of g1.s7.2 (${text.length} characters)`);

    expect(accessibility.act).toHaveBeenCalledWith('g1.s7.1', 'click');
    expect(accessibility.setText).toHaveBeenCalledWith('g1.s7.2', text);
    expect(computer.screenshot).not.toHaveBeenCalled();
  });

  it('honours screenshotAfterAction: true', async () => {
    const { computer } = computerWithAccessibility();
    const { workspace, emitted } = await setup(computer, {
      [WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT]: { screenshotAfterAction: true },
    });
    const result = await emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute(
      { ref: 'g1.s7.1', action: 'click' },
      { workspace },
    );
    expect(isMediaToolResult(result)).toBe(true);
    expect(computer.screenshot).toHaveBeenCalledTimes(1);
  });

  it('surfaces an AccessibilityRefError as a tool error naming the stale ref', async () => {
    const { computer } = computerWithAccessibility({
      act: vi.fn(async (ref: string) => {
        throw new AccessibilityRefError(ref, 'generation', 'provider detail that must not leak');
      }),
    });
    const { workspace, emitted } = await setup(computer);
    await expect(
      emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute({ ref: 'g1.s7.1', action: 'click' }, { workspace }),
    ).rejects.toThrow('Accessibility ref g1.s7.1 is no longer valid (generation); read the tree again');
  });

  it('recognises an AccessibilityRefError from another copy of core by name, ref and reason', async () => {
    const foreign = Object.assign(new Error('foreign copy message'), {
      name: 'AccessibilityRefError',
      ref: 'g1.s7.2',
      reason: 'changed',
    });
    const { computer } = computerWithAccessibility({ setText: vi.fn().mockRejectedValue(foreign) });
    const { workspace, emitted } = await setup(computer);
    const run = emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT].execute(
      { ref: 'g1.s7.2', text: 'x' },
      { workspace },
    );
    await expect(run).rejects.toThrow('Accessibility ref g1.s7.2 is no longer valid (changed); read the tree again');
  });

  it.each([
    ['a bad reason', { ref: 'g1.s7.2', reason: 'stale' }],
    ['a missing ref', { reason: 'gone' }],
    ['a non-string ref', { ref: 42, reason: 'gone' }],
  ])('treats a lookalike with %s as an ordinary error', async (_label, fields) => {
    const lookalike = Object.assign(new Error('ordinary failure'), { name: 'AccessibilityRefError', ...fields });
    const { computer } = computerWithAccessibility({ act: vi.fn().mockRejectedValue(lookalike) });
    const { workspace, emitted } = await setup(computer);
    await expect(
      emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute({ ref: 'g1.s7.1', action: 'click' }, { workspace }),
    ).rejects.toBe(lookalike);
  });

  it('passes other failures through unchanged', async () => {
    const failure = new Error('node supports actions: click, activate');
    const { computer } = computerWithAccessibility({ act: vi.fn().mockRejectedValue(failure) });
    const { workspace, emitted } = await setup(computer);
    await expect(
      emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute({ ref: 'g1.s7.1', action: 'jump' }, { workspace }),
    ).rejects.toBe(failure);
  });

  it('accepts a 40-character ref with node number 999999', async () => {
    const ref = `${'g'.repeat(16)}.${'s'.repeat(16)}.999999`;
    expect(ref).toHaveLength(40);
    const { computer, accessibility } = computerWithAccessibility();
    const { workspace, emitted } = await setup(computer);
    await emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT].execute({ ref, action: 'click' }, { workspace });
    expect(accessibility.act).toHaveBeenCalledWith(ref, 'click');
  });

  it('rejects out-of-range input before calling the capability', async () => {
    const { computer, accessibility } = computerWithAccessibility();
    const { workspace, emitted } = await setup(computer);
    const tree = emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE];
    const act = emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT];
    const setText = emitted[WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT];

    for (const input of [
      { maxDepth: 0 },
      { maxDepth: 41 },
      { maxNodes: 0 },
      { maxNodes: 2001 },
      { maxDepth: 1.5 },
      { app: 'a'.repeat(257) },
    ]) {
      await expect(tree.execute(input, { workspace }), JSON.stringify(input)).resolves.toMatchObject({ error: true });
    }
    for (const ref of [
      'g1.s7',
      'g1..1',
      '.s7.1',
      'g1.s7.x',
      'g 1.s7.1',
      'g1.s7.1;rm',
      'g1.s7.1234567',
      `${'g'.repeat(17)}.${'s'.repeat(16)}.999999`,
    ]) {
      await expect(act.execute({ ref, action: 'click' }, { workspace }), ref).resolves.toMatchObject({ error: true });
    }
    await expect(act.execute({ ref: 'g1.s7.1', action: '' }, { workspace })).resolves.toMatchObject({ error: true });
    await expect(act.execute({ ref: 'g1.s7.1', action: 'a'.repeat(65) }, { workspace })).resolves.toMatchObject({
      error: true,
    });
    await expect(setText.execute({ ref: 'g1.s7.2', text: 'a'.repeat(32769) }, { workspace })).resolves.toMatchObject({
      error: true,
    });

    expect(accessibility.getTree).not.toHaveBeenCalled();
    expect(accessibility.act).not.toHaveBeenCalled();
    expect(accessibility.setText).not.toHaveBeenCalled();
  });
});

describe('AccessibilityRefError', () => {
  it('carries ref, reason, name and the default message', () => {
    const error = new AccessibilityRefError('g1.s7.1', 'gone');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AccessibilityRefError');
    expect(error.ref).toBe('g1.s7.1');
    expect(error.reason).toBe('gone');
    expect(error.message).toBe('Accessibility ref g1.s7.1 is no longer valid (gone); read the tree again');
    expect(new AccessibilityRefError('g1.s7.1', 'malformed', 'custom').message).toBe('custom');
  });
});
