/**
 * E2B Desktop Sandbox Provider Tests
 *
 * Tests desktop-specific functionality layered on `E2BSandbox`:
 * - Desktop SDK factory hooks (create/connect via `@e2b/desktop`)
 * - Default desktop template resolution (no build)
 * - Computer capability mapping (screenshot, mouse, keyboard, stream)
 * - Workspace computer tool emission
 */

import { WORKSPACE_TOOLS, Workspace, createWorkspaceTools, supportsComputer } from '@mastra/core/workspace';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { E2BDesktopSandbox } from './index';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const { mockDesktopSandbox, createMockE2bApi, createMockDesktopApi, resetMockDefaults } = vi.hoisted(() => {
  const createDefaultRunMock = () =>
    vi.fn().mockImplementation((_cmd: string, opts?: any) => {
      const result = { exitCode: 0, stdout: '', stderr: '' };
      if (opts?.background) {
        return Promise.resolve({
          pid: 1000,
          wait: vi.fn().mockResolvedValue(result),
          kill: vi.fn().mockResolvedValue(true),
        });
      }
      return Promise.resolve(result);
    });

  const mockDesktopSandbox = {
    sandboxId: 'mock-desktop-sandbox-id',
    getHost: vi.fn((port: number) => `${port}-mock-desktop-sandbox-id.e2b.app`),
    commands: {
      run: createDefaultRunMock(),
      list: vi.fn().mockResolvedValue([]),
      sendStdin: vi.fn().mockResolvedValue(undefined),
    },
    files: {
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(''),
      list: vi.fn().mockResolvedValue([]),
    },
    kill: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(true),
    // Desktop control surface
    screenshot: vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    leftClick: vi.fn().mockResolvedValue(undefined),
    rightClick: vi.fn().mockResolvedValue(undefined),
    doubleClick: vi.fn().mockResolvedValue(undefined),
    moveMouse: vi.fn().mockResolvedValue(undefined),
    drag: vi.fn().mockResolvedValue(undefined),
    scroll: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    getScreenSize: vi.fn().mockResolvedValue({ width: 1024, height: 720 }),
    getCursorPosition: vi.fn().mockResolvedValue({ x: 10, y: 20 }),
    launch: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
    stream: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getAuthKey: vi.fn().mockReturnValue('auth-key-123'),
      getUrl: vi.fn((opts?: { authKey?: string }) =>
        opts?.authKey
          ? `https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html?password=${opts.authKey}`
          : 'https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html',
      ),
    },
  };

  // Base e2b SDK mock — used by E2BSandbox internals (list/pause/kill, Template)
  const createMockE2bApi = () => {
    const templateFn = vi.fn() as any;
    templateFn.exists = vi.fn().mockResolvedValue(false);
    templateFn.build = vi.fn().mockResolvedValue({ templateId: 'mock-built-template-id' });
    return {
      Sandbox: {
        create: vi.fn().mockRejectedValue(new Error('base e2b Sandbox.create should not be called')),
        connect: vi.fn().mockRejectedValue(new Error('base e2b Sandbox.connect should not be called')),
        list: vi.fn().mockReturnValue({
          nextItems: vi.fn().mockResolvedValue([]),
        }),
        pause: vi.fn().mockResolvedValue(true),
        kill: vi.fn().mockResolvedValue(true),
      },
      Template: templateFn,
    };
  };

  // Desktop SDK mock
  const createMockDesktopApi = () => ({
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockDesktopSandbox),
      connect: vi.fn().mockResolvedValue(mockDesktopSandbox),
    },
  });

  const resetMockDefaults = async () => {
    const e2b = await import('e2b');
    const desktop = await import('@e2b/desktop');
    (e2b.Sandbox.create as any).mockRejectedValue(new Error('base e2b Sandbox.create should not be called'));
    (e2b.Sandbox.connect as any).mockRejectedValue(new Error('base e2b Sandbox.connect should not be called'));
    (e2b.Sandbox.list as any).mockReturnValue({ nextItems: vi.fn().mockResolvedValue([]) });
    ((e2b.Sandbox as any).pause as any).mockResolvedValue(true);
    ((e2b.Sandbox as any).kill as any).mockResolvedValue(true);
    ((e2b.Template as any).exists as any).mockResolvedValue(false);
    ((e2b.Template as any).build as any).mockResolvedValue({ templateId: 'mock-built-template-id' });
    ((desktop.Sandbox as any).create as any).mockResolvedValue(mockDesktopSandbox);
    ((desktop.Sandbox as any).connect as any).mockResolvedValue(mockDesktopSandbox);

    mockDesktopSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
      const result = { exitCode: 0, stdout: '', stderr: '' };
      if (opts?.background) {
        return Promise.resolve({
          pid: 1000,
          wait: vi.fn().mockResolvedValue(result),
          kill: vi.fn().mockResolvedValue(true),
        });
      }
      return Promise.resolve(result);
    });
    mockDesktopSandbox.screenshot.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    mockDesktopSandbox.leftClick.mockResolvedValue(undefined);
    mockDesktopSandbox.rightClick.mockResolvedValue(undefined);
    mockDesktopSandbox.doubleClick.mockResolvedValue(undefined);
    mockDesktopSandbox.moveMouse.mockResolvedValue(undefined);
    mockDesktopSandbox.drag.mockResolvedValue(undefined);
    mockDesktopSandbox.scroll.mockResolvedValue(undefined);
    mockDesktopSandbox.write.mockResolvedValue(undefined);
    mockDesktopSandbox.press.mockResolvedValue(undefined);
    mockDesktopSandbox.getScreenSize.mockResolvedValue({ width: 1024, height: 720 });
    mockDesktopSandbox.getCursorPosition.mockResolvedValue({ x: 10, y: 20 });
    mockDesktopSandbox.stream.start.mockResolvedValue(undefined);
    mockDesktopSandbox.stream.getAuthKey.mockReturnValue('auth-key-123');
    mockDesktopSandbox.stream.getUrl.mockImplementation((opts?: { authKey?: string }) =>
      opts?.authKey
        ? `https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html?password=${opts.authKey}`
        : 'https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html',
    );
  };

  return { mockDesktopSandbox, createMockE2bApi, createMockDesktopApi, resetMockDefaults };
});

vi.mock('e2b', () => createMockE2bApi());
vi.mock('@e2b/desktop', () => createMockDesktopApi());

describe('E2BDesktopSandbox', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  describe('Constructor & Options', () => {
    it('has desktop provider and name', () => {
      const sandbox = new E2BDesktopSandbox();

      expect(sandbox.provider).toBe('e2b-desktop');
      expect(sandbox.name).toBe('E2BDesktopSandbox');
    });

    it('exposes the computer capability', () => {
      const sandbox = new E2BDesktopSandbox();

      expect(sandbox.computer).toBeDefined();
      expect(supportsComputer(sandbox)).toBe(true);
    });

    it('clone returns an E2BDesktopSandbox with inherited options', () => {
      const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720], timeout: 60_000 });

      const cloned = sandbox.clone({ id: 'cloned-id' });

      expect(cloned).toBeInstanceOf(E2BDesktopSandbox);
      expect(cloned.id).toBe('cloned-id');
      expect((cloned as any).resolution).toEqual([1280, 720]);
      expect((cloned as any).timeout).toBe(60_000);
    });
  });

  describe('Template Resolution & SDK Factory Hooks', () => {
    it('creates via the desktop SDK with the desktop template by default', async () => {
      const desktop = await import('@e2b/desktop');
      const e2b = await import('e2b');
      const sandbox = new E2BDesktopSandbox();

      await sandbox._start();

      expect(desktop.Sandbox.create).toHaveBeenCalledTimes(1);
      expect((desktop.Sandbox.create as any).mock.calls[0][0]).toBe('desktop');
      expect(e2b.Sandbox.create).not.toHaveBeenCalled();
      expect((e2b.Template as any).exists).not.toHaveBeenCalled();
      expect((e2b.Template as any).build).not.toHaveBeenCalled();
    });

    it('uses an explicit template ID as-is', async () => {
      const desktop = await import('@e2b/desktop');
      const sandbox = new E2BDesktopSandbox({ template: 'my-desktop-template' });

      await sandbox._start();

      expect((desktop.Sandbox.create as any).mock.calls[0][0]).toBe('my-desktop-template');
    });

    it('passes resolution and dpi to desktop creation', async () => {
      const desktop = await import('@e2b/desktop');
      const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720], dpi: 96 });

      await sandbox._start();

      const opts = (desktop.Sandbox.create as any).mock.calls[0][1];
      expect(opts.resolution).toEqual([1280, 720]);
      expect(opts.dpi).toBe(96);
      expect(opts.timeoutMs).toBe(300_000);
      expect(opts.metadata['mastra-sandbox-id']).toBe(sandbox.id);
    });

    it('reconnects to an existing sandbox via the desktop SDK', async () => {
      const desktop = await import('@e2b/desktop');
      const e2b = await import('e2b');
      (e2b.Sandbox.list as any).mockReturnValue({
        nextItems: vi.fn().mockResolvedValue([{ sandboxId: 'existing-desktop-id', state: 'running' }]),
      });
      const sandbox = new E2BDesktopSandbox({ id: 'reconnect-me' });

      await sandbox._start();

      expect(desktop.Sandbox.connect).toHaveBeenCalledWith('existing-desktop-id', expect.anything());
      expect(desktop.Sandbox.create).not.toHaveBeenCalled();
      expect(e2b.Sandbox.connect).not.toHaveBeenCalled();
    });
  });

  describe('Computer Capability', () => {
    it('screenshot returns SDK PNG bytes', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      const shot = await sandbox.computer.screenshot();

      expect(mockDesktopSandbox.screenshot).toHaveBeenCalled();
      expect(shot.mediaType).toBe('image/png');
      expect(Array.from(shot.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });

    it('maps mouse operations to the desktop SDK', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      await sandbox.computer.leftClick(10, 20);
      await sandbox.computer.rightClick(30, 40);
      await sandbox.computer.doubleClick(50, 60);
      await sandbox.computer.moveMouse(5, 6);
      await sandbox.computer.drag({ x: 1, y: 2 }, { x: 3, y: 4 });
      await sandbox.computer.scroll('down', 3);

      expect(mockDesktopSandbox.leftClick).toHaveBeenCalledWith(10, 20);
      expect(mockDesktopSandbox.rightClick).toHaveBeenCalledWith(30, 40);
      expect(mockDesktopSandbox.doubleClick).toHaveBeenCalledWith(50, 60);
      expect(mockDesktopSandbox.moveMouse).toHaveBeenCalledWith(5, 6);
      expect(mockDesktopSandbox.drag).toHaveBeenCalledWith([1, 2], [3, 4]);
      expect(mockDesktopSandbox.scroll).toHaveBeenCalledWith('down', 3);
    });

    it('maps keyboard operations to the desktop SDK', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      await sandbox.computer.type('hello world');
      await sandbox.computer.press('Enter');
      await sandbox.computer.press(['ctrl', 's']);

      expect(mockDesktopSandbox.write).toHaveBeenCalledWith('hello world');
      expect(mockDesktopSandbox.press).toHaveBeenNthCalledWith(1, 'Enter');
      expect(mockDesktopSandbox.press).toHaveBeenNthCalledWith(2, ['ctrl', 's']);
    });

    it('reports screen size and cursor position', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      await expect(sandbox.computer.getScreenSize()).resolves.toEqual({ width: 1024, height: 720 });
      await expect(sandbox.computer.getCursorPosition()).resolves.toEqual({ x: 10, y: 20 });
    });

    it('operations start the sandbox automatically when not running', async () => {
      const desktop = await import('@e2b/desktop');
      const sandbox = new E2BDesktopSandbox();

      await sandbox.computer.leftClick(1, 2);

      expect(desktop.Sandbox.create).toHaveBeenCalledTimes(1);
      expect(mockDesktopSandbox.leftClick).toHaveBeenCalledWith(1, 2);
    });

    it('recreates the desktop sandbox when an operation detects a dead VM', async () => {
      const desktop = await import('@e2b/desktop');
      mockDesktopSandbox.leftClick
        .mockRejectedValueOnce(new Error('sandbox has been killed'))
        .mockResolvedValueOnce(undefined);
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      await sandbox.computer.leftClick(1, 2);

      expect(desktop.Sandbox.create).toHaveBeenCalledTimes(2);
      expect(mockDesktopSandbox.leftClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Stream URL', () => {
    it('starts an authenticated stream and returns the viewer URL', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      const url = await sandbox.computer.streamUrl!();

      expect(mockDesktopSandbox.stream.start).toHaveBeenCalledWith({ requireAuth: true });
      expect(url).toBe('https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html?password=auth-key-123');
    });

    it('memoizes stream startup across calls', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      await sandbox.computer.streamUrl!();
      await sandbox.computer.streamUrl!();

      expect(mockDesktopSandbox.stream.start).toHaveBeenCalledTimes(1);
    });

    it('tolerates an externally started stream', async () => {
      mockDesktopSandbox.stream.start.mockRejectedValue(new Error('Stream is already running'));
      mockDesktopSandbox.stream.getAuthKey.mockImplementation(() => {
        throw new Error('auth not enabled');
      });
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      const url = await sandbox.computer.streamUrl!();

      expect(url).toBe('https://6080-mock-desktop-sandbox-id.e2b.app/vnc.html');
    });

    it('returns null when the stream cannot start', async () => {
      mockDesktopSandbox.stream.start.mockRejectedValue(new Error('boom'));
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      const url = await sandbox.computer.streamUrl!();

      expect(url).toBeNull();
    });
  });

  describe('Workspace Tool Emission', () => {
    it('emits exactly the workspace computer tool set', async () => {
      const sandbox = new E2BDesktopSandbox();
      const workspace = new Workspace({ sandbox });

      const tools = await createWorkspaceTools(workspace);

      const computerToolNames = Object.keys(tools).filter(name => name.startsWith('mastra_workspace_computer_'));
      expect(computerToolNames.sort()).toEqual(Object.values(WORKSPACE_TOOLS.COMPUTER).sort());
    });
  });

  describe('Desktop Escape Hatch', () => {
    it('desktop getter exposes the raw SDK sandbox', async () => {
      const sandbox = new E2BDesktopSandbox();
      await sandbox._start();

      expect(sandbox.desktop).toBe(mockDesktopSandbox);
    });

    it('desktop getter throws when not started', () => {
      const sandbox = new E2BDesktopSandbox();

      expect(() => sandbox.desktop).toThrow();
    });
  });
});
