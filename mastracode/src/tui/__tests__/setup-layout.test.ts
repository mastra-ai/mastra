import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

const { renderBannerMock, updateStatusLineMock, getUserIdMock } = vi.hoisted(() => ({
  renderBannerMock: vi.fn(),
  updateStatusLineMock: vi.fn(),
  getUserIdMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {},
}));

vi.mock('@earendil-works/pi-tui', () => ({
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
  renderBanner: renderBannerMock,
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

vi.mock('../../utils/project.js', () => ({
  getUserId: getUserIdMock,
}));

import { renderBanner } from '../components/banner.js';
import { buildLayout, subscribeToHarness } from '../setup.js';
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
      options: { appName: 'Acme Code', version: '1.2.3' },
      projectInfo: {
        name: 'demo-project',
        resourceId: 'resource-123',
        gitBranch: 'feature/banner',
        isWorktree: true,
        mainRepoPath: '/repos/main',
        rootPath: '/repos/demo',
      },
      harness: {
        listModes: vi.fn(() => Array.from({ length: modeCount }, (_, i) => ({ id: `mode-${i}` }))),
      },
      ui: {
        addChild: vi.fn(child => uiChildren.push(child)),
        setFocus: vi.fn(),
      },
      chatContainer: { type: 'chat' },
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
  it('renders banner, project frontmatter, startup hints, containers, footer, and editor focus in order', () => {
    renderBannerMock.mockReturnValue('BANNER v1.2.3');
    getUserIdMock.mockReturnValue('user-abc');
    const refreshModelAuthStatus = vi.fn();
    const { state, uiChildren, editorChildren, footerChildren, editor } = createState();

    buildLayout(state, refreshModelAuthStatus);

    expect(renderBanner).toHaveBeenCalledWith('1.2.3', 'Acme Code');
    expect(textOf(uiChildren[1])).toBe('BANNER v1.2.3');
    expect(textOf(uiChildren[2])).toBe(
      [
        'Project: demo-project',
        'Resource ID: resource-123',
        'Branch: feature/banner',
        'Worktree of: /repos/main',
        'User: user-abc',
      ].join('\n'),
    );
    expect(textOf(uiChildren[4])).toBe('  ⇧+Tab cycle modes · /help info & shortcuts');
    expect(uiChildren[6]).toBe(state.chatContainer);
    expect(uiChildren[7]).toBe(state.taskProgress);
    expect(uiChildren[8]).toBe(state.editorContainer);
    expect(uiChildren[9]).toBe(state.footer);
    expect(state.taskProgress.quietMode).toBe(true);
    expect(editorChildren).toEqual([state.idleCounter, editor]);
    expect(footerChildren).toEqual([state.statusLine, state.memoryStatusLine]);
    expect(updateStatusLine).toHaveBeenCalledWith(state);
    expect(refreshModelAuthStatus).toHaveBeenCalledTimes(1);
    expect(state.ui.setFocus).toHaveBeenCalledWith(editor);
  });

  it('omits the mode-cycle startup hint when there is only one mode', () => {
    renderBannerMock.mockReturnValue('BANNER v1.2.3');
    getUserIdMock.mockReturnValue('user-abc');
    const { state, uiChildren } = createState(1);

    buildLayout(state, vi.fn());

    expect(textOf(uiChildren[4])).toBe('  /help info & shortcuts');
  });

  it('serializes harness event handling so abort cleanup cannot interleave with stream updates', async () => {
    let listener: ((event: { type: string }) => Promise<void>) | undefined;
    const state = {
      harness: {
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

    subscribeToHarness(state, handleEvent);
    const first = listener?.({ type: 'message_update' });
    const second = listener?.({ type: 'agent_end' });
    await Promise.resolve();

    expect(order).toEqual(['start:message_update']);

    releaseFirst.resolve();
    await first;
    await second;

    expect(order).toEqual(['start:message_update', 'end:message_update', 'start:agent_end', 'end:agent_end']);
  });
});
