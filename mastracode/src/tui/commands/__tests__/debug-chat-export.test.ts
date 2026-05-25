import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Track whether mkdirSync should throw for the write-failure test
// Use var so the vi.mock factory (hoisted) can access this binding
var failMkdirCallCount = 0;

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn((...args: Parameters<typeof fs.mkdirSync>) => {
      // Fail on the second call (the one inside the atomic write try block)
      if (failMkdirCallCount > 0) {
        failMkdirCallCount--;
        if (failMkdirCallCount === 0) {
          throw new Error('disk full');
        }
      }
      return actual.mkdirSync(...args);
    }),
  };
});

const IS_WINDOWS = process.platform === 'win32';

import { handleDebugChatExportCommand } from '../debug-chat-export.js';
import type { SlashCommandContext } from '../types.js';

interface MockHarness {
  getCurrentThreadId: () => string | null;
  getResourceId: () => string;
  listThreads: () => Promise<unknown[]>;
  listMessages: () => Promise<unknown[]>;
  getObservationalMemoryRecord: () => Promise<unknown>;
  getObservationalMemoryHistory: () => Promise<unknown[]>;
  getObserverModelId: () => string | undefined;
  getReflectorModelId: () => string | undefined;
  getObservationThreshold: () => number | undefined;
  getReflectionThreshold: () => number | undefined;
  getCurrentModelId: () => string;
  getCurrentModeId: () => string;
  getState: () => unknown;
}

interface MockSetup {
  ctx: SlashCommandContext;
  infoMessages: string[];
  errorMessages: string[];
  harness: MockHarness;
}

function createMockSetup(overrides: Partial<MockHarness> = {}): MockSetup {
  const harness: MockHarness = {
    getCurrentThreadId: () => 'thread-1234-5678-90ab',
    getResourceId: () => 'resource-abc',
    listThreads: async () => [
      {
        id: 'thread-1234-5678-90ab',
        resourceId: 'resource-abc',
        title: 'Test thread',
        createdAt: new Date('2026-05-13T12:00:00.000Z'),
        updatedAt: new Date('2026-05-13T12:30:00.000Z'),
      },
    ],
    listMessages: async () => [
      { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hello' }], createdAt: new Date() },
      { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'hi' }], createdAt: new Date() },
    ],
    getObservationalMemoryRecord: async () => ({
      id: 'om-1',
      scope: 'thread',
      threadId: 'thread-1234-5678-90ab',
      resourceId: 'resource-abc',
      generationCount: 2,
      activeObservations: 'observation text',
      bufferedReflection: 'pending reflection',
    }),
    getObservationalMemoryHistory: async () => [
      { id: 'om-0', scope: 'thread', generationCount: 1, activeObservations: 'older' },
    ],
    getObserverModelId: () => 'observer-model',
    getReflectorModelId: () => 'reflector-model',
    getObservationThreshold: () => 30000,
    getReflectionThreshold: () => 40000,
    getCurrentModelId: () => 'main-model',
    getCurrentModeId: () => 'default',
    getState: () => ({ observerModelId: 'observer-model', someFlag: true }),
    ...overrides,
  };

  const infoMessages: string[] = [];
  const errorMessages: string[] = [];

  const ctx: SlashCommandContext = {
    state: { options: { version: '9.9.9-test' } },
    harness: harness as any,
    showInfo: vi.fn((msg: string) => infoMessages.push(msg)),
    showError: vi.fn((msg: string) => errorMessages.push(msg)),
    updateStatusLine: vi.fn(),
    stop: vi.fn(),
    getResolvedWorkspace: vi.fn(),
    addUserMessage: vi.fn(),
    renderExistingMessages: vi.fn(async () => {}),
    showOnboarding: vi.fn(async () => {}),
    customSlashCommands: [],
  } as unknown as SlashCommandContext;

  return { ctx, infoMessages, errorMessages, harness };
}

describe('handleDebugChatExportCommand', () => {
  let tmpDir: string;
  let prevXdgDataHome: string | undefined;
  let prevHome: string | undefined;
  let prevAppData: string | undefined;

  beforeEach(() => {
    failMkdirCallCount = 0;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-chat-export-'));
    // Redirect the app data dir to our temp directory (works on Linux/macOS/Windows).
    prevXdgDataHome = process.env.XDG_DATA_HOME;
    prevHome = process.env.HOME;
    prevAppData = process.env.APPDATA;
    process.env.XDG_DATA_HOME = tmpDir;
    process.env.HOME = tmpDir;
    process.env.APPDATA = tmpDir;
  });

  afterEach(() => {
    if (prevXdgDataHome === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = prevXdgDataHome;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prevAppData;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows an error when there is no active thread', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup({
      getCurrentThreadId: () => null,
    });

    await handleDebugChatExportCommand(ctx);

    expect(infoMessages).toEqual([]);
    expect(errorMessages[0]).toContain('No active thread');
  });

  it('writes thread/messages/OM JSON files to the app data dir', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup();

    await handleDebugChatExportCommand(ctx);

    expect(errorMessages).toEqual([]);
    expect(infoMessages[0]).toContain('Exported debug chat data to:');

    const exportDirLine = infoMessages[0]!.split('\n').find(l => l.trim().startsWith(tmpDir));
    expect(exportDirLine).toBeDefined();
    const exportDir = exportDirLine!.trim();

    expect(fs.existsSync(exportDir)).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'thread.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'messages.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'om-current.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'om-history.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'meta.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'README.md'))).toBe(true);

    const thread = JSON.parse(fs.readFileSync(path.join(exportDir, 'thread.json'), 'utf8'));
    expect(thread.id).toBe('thread-1234-5678-90ab');
    expect(thread.title).toBe('Test thread');

    const messages = JSON.parse(fs.readFileSync(path.join(exportDir, 'messages.json'), 'utf8'));
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('m1');

    const omCurrent = JSON.parse(fs.readFileSync(path.join(exportDir, 'om-current.json'), 'utf8'));
    expect(omCurrent.id).toBe('om-1');
    expect(omCurrent.generationCount).toBe(2);
    expect(omCurrent.bufferedReflection).toBe('pending reflection');

    const omHistory = JSON.parse(fs.readFileSync(path.join(exportDir, 'om-history.json'), 'utf8'));
    expect(omHistory).toHaveLength(1);
    expect(omHistory[0].generationCount).toBe(1);

    const meta = JSON.parse(fs.readFileSync(path.join(exportDir, 'meta.json'), 'utf8'));
    expect(meta.mastracodeVersion).toBe('9.9.9-test');
    expect(meta.om.observerModelId).toBe('observer-model');
    expect(meta.om.reflectorModelId).toBe('reflector-model');
    expect(meta.om.observationThreshold).toBe(30000);
    expect(meta.om.reflectionThreshold).toBe(40000);
    expect(meta.currentModelId).toBe('main-model');
    expect(meta.state.someFlag).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, 'manifest.json'), 'utf8'));
    expect(manifest.threadId).toBe('thread-1234-5678-90ab');
    expect(manifest.messageCount).toBe(2);
    expect(manifest.omHistoryCount).toBe(1);
    expect(manifest.hasCurrentOm).toBe(true);
  });

  it('still exports successfully when there is no OM record yet', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup({
      getObservationalMemoryRecord: async () => null,
      getObservationalMemoryHistory: async () => [],
    });

    await handleDebugChatExportCommand(ctx);

    expect(errorMessages).toEqual([]);
    expect(infoMessages[0]).toContain('Current OM record: none');

    const exportDirLine = infoMessages[0]!.split('\n').find(l => l.trim().startsWith(tmpDir));
    const exportDir = exportDirLine!.trim();

    const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, 'manifest.json'), 'utf8'));
    expect(manifest.hasCurrentOm).toBe(false);
    expect(manifest.omHistoryCount).toBe(0);

    const omCurrent = JSON.parse(fs.readFileSync(path.join(exportDir, 'om-current.json'), 'utf8'));
    expect(omCurrent).toBeNull();
  });

  it('reports an error when listing messages fails', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup({
      listMessages: async () => {
        throw new Error('storage offline');
      },
    });

    await handleDebugChatExportCommand(ctx);

    expect(infoMessages).toEqual([]);
    expect(errorMessages[0]).toContain('Failed to read messages: storage offline');
  });

  it('reports an error when listThreads fails and writes nothing', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup({
      listThreads: async () => {
        throw new Error('thread storage unavailable');
      },
    });

    await handleDebugChatExportCommand(ctx);

    expect(infoMessages).toEqual([]);
    expect(errorMessages[0]).toContain('Failed to list threads: thread storage unavailable');

    // Verify no export directory was created
    const debugExportsDir = path.join(tmpDir, 'debug-exports');
    expect(fs.existsSync(debugExportsDir)).toBe(false);
  });

  it('reports an error on filesystem write failure and does not leave a temp directory', async () => {
    const { ctx, infoMessages, errorMessages } = createMockSetup();

    // Fail on the first mkdirSync call (debugRoot creation, previously unguarded)
    failMkdirCallCount = 1;

    await handleDebugChatExportCommand(ctx);

    expect(infoMessages).toEqual([]);
    expect(errorMessages[0]).toContain('Failed to write export');
    expect(errorMessages[0]).toContain('disk full');

    // Verify no export directory was created for this failed export
    const debugExportsDir = path.join(tmpDir, 'debug-exports');
    if (fs.existsSync(debugExportsDir)) {
      const entries = fs.readdirSync(debugExportsDir);
      const tmpDirs = entries.filter(e => e.startsWith('.tmp-'));
      expect(tmpDirs).toHaveLength(0);
    }
  });

  it('applies restrictive permissions on non-Windows platforms', async () => {
    // Skip on Windows where POSIX permission bits don't apply
    if (IS_WINDOWS) return;

    const { ctx, infoMessages } = createMockSetup();

    await handleDebugChatExportCommand(ctx);

    const exportDirLine = infoMessages[0]!.split('\n').find(l => l.trim().startsWith(tmpDir));
    expect(exportDirLine).toBeDefined();
    const exportDir = exportDirLine!.trim();

    // Check directory permission
    const dirStat = fs.statSync(exportDir);
    // 0o700 = owner rwx only
    expect(dirStat.mode & 0o777).toBe(0o700);

    // Check a sample file permission
    const threadStat = fs.statSync(path.join(exportDir, 'thread.json'));
    // 0o600 = owner rw only
    expect(threadStat.mode & 0o777).toBe(0o600);

    // Check README.md too (written via writeFileSync directly)
    const readmeStat = fs.statSync(path.join(exportDir, 'README.md'));
    expect(readmeStat.mode & 0o777).toBe(0o600);
  });

  it('serializes OM history from the harness method faithfully', async () => {
    const { ctx, infoMessages } = createMockSetup({
      getObservationalMemoryHistory: async () => [
        { id: 'prior-2', generationCount: 5, activeObservations: 'gen-5' },
        { id: 'prior-1', generationCount: 3, activeObservations: 'gen-3' },
      ],
    });

    await handleDebugChatExportCommand(ctx);

    const exportDirLine = infoMessages[0]!.split('\n').find((l: string) => l.trim().startsWith(tmpDir));
    const exportDir = exportDirLine!.trim();

    const omHistory = JSON.parse(fs.readFileSync(path.join(exportDir, 'om-history.json'), 'utf8'));
    expect(omHistory).toHaveLength(2);
    expect(omHistory[0].id).toBe('prior-2');
    expect(omHistory[1].id).toBe('prior-1');
  });
});
