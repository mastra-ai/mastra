import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

const { headerOptionsMock, updateStatusLineMock } = vi.hoisted(() => ({
  headerOptionsMock: vi.fn(),
  updateStatusLineMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {},
}));

vi.mock('@earendil-works/pi-tui', () => ({
  Box: class {},
  CombinedAutocompleteProvider: class {},
  Container: class {
    children: unknown[] = [];
    addChild(child: unknown) {
      this.children.push(child);
    }
  },
  Spacer: class {
    type = 'spacer';
    constructor(public height: number) {}
  },
  Text: class {
    type = 'text';
    constructor(
      public text: string,
      public x = 0,
      public y = 0,
    ) {}
  },
}));

vi.mock('../components/banner.js', () => ({
  HeaderComponent: class {
    type = 'header';
    constructor(public options: unknown) {
      headerOptionsMock(options);
    }
  },
}));

vi.mock('../components/surface.js', () => ({
  keyHint: (key: string, description: string) => `[${key}] ${description}`,
}));

vi.mock('../components/task-progress.js', () => ({
  TaskProgressComponent: class {
    quietMode: boolean | undefined;
    setQuietMode(value: boolean) {
      this.quietMode = value;
    }
  },
}));

vi.mock('../components/idle-counter.js', () => ({
  IdleCounterComponent: class {},
}));

vi.mock('../status-line.js', () => ({
  updateStatusLine: updateStatusLineMock,
}));

vi.mock('../model-packs/apply.js', () => ({
  switchModeWithPack: vi.fn(),
}));

import { buildLayout, subscribeToAgentController } from '../setup.js';
import { updateStatusLine } from '../status-line.js';

function textOf(child: unknown) {
  return stripAnsi((child as { text?: string }).text ?? '');
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

function createState(modeCount = 2) {
  const uiChildren: unknown[] = [];
  const editorChildren: unknown[] = [];
  const footerChildren: unknown[] = [];
  const editor = {};

  return {
    state: {
      options: { appName: 'Acme Code', version: '1.2.3', backgroundToolsEnabled: true },
      projectInfo: {
        name: 'demo-project',
        resourceId: 'resource-123',
        gitBranch: 'feature/banner',
        isWorktree: true,
        mainRepoPath: '/repos/main',
        rootPath: '/repos/demo',
      },
      controller: {
        listModes: vi.fn(() => Array.from({ length: modeCount }, (_, i) => ({ id: `mode-${i}` }))),
      },
      ui: {
        addChild: vi.fn(child => uiChildren.push(child)),
        setFocus: vi.fn(),
        hasOverlay: vi.fn(() => false),
        hideOverlay: vi.fn(),
      },
      chatContainer: { type: 'chat' },
      globalBackgroundNoticeContainer: { type: 'global-background-notice' },
      editorContainer: { type: 'editor-container', addChild: vi.fn(child => editorChildren.push(child)) },
      editor,
      footer: { type: 'footer', addChild: vi.fn(child => footerChildren.push(child)) },
      quietMode: true,
    } as any,
    uiChildren,
    editorChildren,
    footerChildren,
    editor,
  };
}

describe('buildLayout startup header', () => {
  it('renders the header, startup hints, containers, Working row, footer, and editor focus in order', () => {
    const refreshModelAuthStatus = vi.fn();
    const { state, uiChildren, editorChildren, footerChildren, editor } = createState();

    buildLayout(state, refreshModelAuthStatus);

    expect(headerOptionsMock).toHaveBeenCalledWith({
      version: '1.2.3',
      appName: 'Acme Code',
      info: [
        'Project: demo-project',
        'Resource ID: resource-123',
        'Branch: feature/banner',
        'Worktree of: /repos/main',
      ],
    });
    expect((uiChildren[1] as { type: string }).type).toBe('header');
    expect(textOf(uiChildren[3])).toBe('  [shift+tab] cycle modes · [/help] info & shortcuts');
    expect(uiChildren[5]).toBe(state.chatContainer);
    expect(uiChildren[6]).toBe(state.taskProgress);
    expect(uiChildren[7]).toBe(state.globalBackgroundNoticeContainer);
    expect(uiChildren[8]).toBe(state.editorContainer);
    expect(uiChildren[9]).toBe(state.footer);
    expect(state.taskProgress.quietMode).toBe(true);
    expect(editorChildren).toEqual([state.idleCounter, state.activityLine, editor]);
    expect(footerChildren).toEqual([state.statusLine, state.memoryStatusLine]);
    expect(updateStatusLine).toHaveBeenCalledWith(state);
    expect(refreshModelAuthStatus).toHaveBeenCalledTimes(1);
    expect(state.ui.setFocus).toHaveBeenCalledWith(editor);
  });

  it('omits the background notice container when background tools are disabled', () => {
    const { state, uiChildren } = createState();
    state.options.backgroundToolsEnabled = false;

    buildLayout(state, vi.fn());

    expect(uiChildren).not.toContain(state.globalBackgroundNoticeContainer);
  });

  it('omits the mode-cycle startup hint when there is only one mode', () => {
    const { state, uiChildren } = createState(1);

    buildLayout(state, vi.fn());

    expect(textOf(uiChildren[3])).toBe('  [/help] info & shortcuts');
  });

  it('serializes controller event handling so abort cleanup cannot interleave with stream updates', async () => {
    let listener: ((event: { type: string }) => Promise<void>) | undefined;
    const state = {
      options: { backgroundToolsEnabled: false },
      session: {
        subscribe: vi.fn((handler: typeof listener) => {
          listener = handler;
          return vi.fn();
        }),
      },
    } as any;
    const releaseFirst = createDeferred<void>();
    const order: string[] = [];
    const handleEvent = vi.fn(async (event: { type: string }) => {
      order.push(`start:${event.type}`);
      if (event.type === 'message_update') {
        await releaseFirst.promise;
      }
      order.push(`end:${event.type}`);
    });

    subscribeToAgentController(state, handleEvent);
    const first = listener?.({ type: 'message_update' });
    const second = listener?.({ type: 'agent_end' });
    await Promise.resolve();

    expect(state.waitForAgentControllerEvents).toBeUndefined();
    expect(order).toEqual(['start:message_update']);

    releaseFirst.resolve();
    await first;
    await second;

    expect(order).toEqual(['start:message_update', 'end:message_update', 'start:agent_end', 'end:agent_end']);
  });

  it('does not block the finite event queue on a suspended interactive prompt when background tools are enabled', async () => {
    let listener: ((event: { type: string }) => Promise<void>) | undefined;
    const state = {
      options: { backgroundToolsEnabled: true },
      session: {
        subscribe: vi.fn((handler: typeof listener) => {
          listener = handler;
          return vi.fn();
        }),
      },
    } as any;
    const answerPrompt = createDeferred<void>();
    const order: string[] = [];
    const handleEvent = vi.fn(async (event: { type: string }) => {
      order.push(`start:${event.type}`);
      if (event.type === 'tool_suspended') {
        await answerPrompt.promise;
      }
      order.push(`end:${event.type}`);
    });

    subscribeToAgentController(state, handleEvent);
    const prompt = listener?.({ type: 'tool_suspended' });
    const threadChange = listener?.({ type: 'thread_changed' });
    const drained = state.waitForAgentControllerEvents?.();
    expect(drained).toBeDefined();
    await drained;

    expect(order).toEqual(['start:tool_suspended', 'start:thread_changed', 'end:thread_changed']);

    answerPrompt.resolve();
    await prompt;
    await threadChange;
    await vi.waitFor(() =>
      expect(order).toEqual([
        'start:tool_suspended',
        'start:thread_changed',
        'end:thread_changed',
        'end:tool_suspended',
      ]),
    );
  });

  it('preserves serial event handling for suspended prompts when background tools are disabled', async () => {
    let listener: ((event: { type: string }) => Promise<void>) | undefined;
    const state = {
      options: { backgroundToolsEnabled: false },
      session: {
        subscribe: vi.fn((handler: typeof listener) => {
          listener = handler;
          return vi.fn();
        }),
      },
    } as any;
    const answerPrompt = createDeferred<void>();
    const order: string[] = [];
    const handleEvent = vi.fn(async (event: { type: string }) => {
      order.push(`start:${event.type}`);
      if (event.type === 'tool_suspended') {
        await answerPrompt.promise;
      }
      order.push(`end:${event.type}`);
    });

    subscribeToAgentController(state, handleEvent);
    const prompt = listener?.({ type: 'tool_suspended' });
    const threadChange = listener?.({ type: 'thread_changed' });
    await Promise.resolve();

    expect(state.waitForAgentControllerEvents).toBeUndefined();
    expect(order).toEqual(['start:tool_suspended']);

    answerPrompt.resolve();
    await prompt;
    await threadChange;

    expect(order).toEqual(['start:tool_suspended', 'end:tool_suspended', 'start:thread_changed', 'end:thread_changed']);
  });
});
