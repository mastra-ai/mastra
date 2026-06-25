/**
 * Tests for per-mode workspace tool visibility via `mode.availableTools`.
 *
 * These tests verify the core invariant: one shared workspace across modes,
 * with tool visibility gated per LLM call via `activeTools`.  Workspace tools
 * are treated as ordinary tools in the mode's unified `availableTools` list,
 * matched by their exposed (renamed) names (e.g. `view`, `find_files`).
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { WORKSPACE_TOOLS } from '../../workspace/constants';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
import { Harness } from '../harness';
import type { HarnessMode } from '../types';

vi.setConfig({ testTimeout: 30_000 });

/** Tool name overrides — matches Mastra Code's TOOL_NAME_OVERRIDES. */
const TOOL_NAME_OVERRIDES: Record<string, { name: string }> = {
  [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { name: 'view' },
  [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { name: 'write_file' },
  [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { name: 'string_replace_lsp' },
  [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: { name: 'find_files' },
  [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { name: 'delete_file' },
  [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: { name: 'file_stat' },
  [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { name: 'mkdir' },
  [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { name: 'search_content' },
  [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { name: 'ast_smart_edit' },
  [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { name: 'execute_command' },
  [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]: { name: 'get_process_output' },
  [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS]: { name: 'kill_process' },
  [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { name: 'lsp_inspect' },
};

/** A text-only stream — no tool calls, so no approval flow needed. */
function createTextStream(text = 'Done.') {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', textDelta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
  ]);
}

describe('Harness: mode availableTools with shared workspace', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mode-ws-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  function createWorkspace() {
    return new Workspace({
      id: 'test-ws',
      name: 'Test Workspace',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: TOOL_NAME_OVERRIDES,
    });
  }

  async function setupHarness({ modes, workspace }: { modes: HarnessMode[]; workspace: Workspace }) {
    const model = new MockLanguageModelV2({
      doStream: (async (_options: any) => ({ stream: createTextStream() })) as any,
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: model as any,
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('test-agent');

    const harness = new Harness({
      id: 'test-harness',
      storage,
      agent: registeredAgent,
      modes,
      workspace,
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    return { harness, session, registeredAgent, workspace };
  }

  it('workspace tool names are matched by exposed names in availableTools', async () => {
    const workspace = createWorkspace();
    const planMode: HarnessMode = {
      id: 'plan',
      name: 'Plan',
      default: true,
      availableTools: [
        'view',
        'find_files',
        'search_content',
        'file_stat',
        'lsp_inspect',
        'write_file',
        'string_replace_lsp',
        'ask_user',
        'submit_plan',
      ],
    };

    const { session, registeredAgent } = await setupHarness({
      modes: [planMode],
      workspace,
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    const callArgs = streamSpy.mock.calls[0] as unknown as [any, any];
    const streamOptions = callArgs[1];
    // activeTools must contain the exposed (renamed) workspace tool names
    expect(streamOptions.activeTools).toBeDefined();
    expect(streamOptions.activeTools).toContain('view');
    expect(streamOptions.activeTools).toContain('find_files');
    expect(streamOptions.activeTools).toContain('search_content');
    expect(streamOptions.activeTools).toContain('file_stat');
    expect(streamOptions.activeTools).toContain('lsp_inspect');
    // Write tools also included for plan files
    expect(streamOptions.activeTools).toContain('write_file');
    expect(streamOptions.activeTools).toContain('string_replace_lsp');
    // Tools NOT in availableTools must not appear
    expect(streamOptions.activeTools).not.toContain('execute_command');
    expect(streamOptions.activeTools).not.toContain('delete_file');
    expect(streamOptions.activeTools).not.toContain('ast_smart_edit');
  });

  it('mode switching changes activeTools without replacing the workspace instance', async () => {
    const workspace = createWorkspace();
    const planMode: HarnessMode = {
      id: 'plan',
      name: 'Plan',
      default: true,
      transitionsTo: 'build',
      availableTools: ['view', 'find_files', 'search_content', 'ask_user', 'submit_plan'],
    };
    const buildMode: HarnessMode = {
      id: 'build',
      name: 'Build',
      // No availableTools — full access
    };

    const {
      session,
      registeredAgent,
      workspace: resolvedWorkspace,
    } = await setupHarness({
      modes: [planMode, buildMode],
      workspace,
    });

    // --- Plan mode (default) ---
    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello in plan mode' });

    let callArgs = streamSpy.mock.calls[0] as unknown as [any, any];
    let streamOptions = callArgs[1];
    expect(streamOptions.activeTools).toBeDefined();
    expect(streamOptions.activeTools).toContain('view');
    expect(streamOptions.activeTools).not.toContain('execute_command');

    // Capture the workspace reference used in plan mode
    const workspaceInPlanMode = resolvedWorkspace;

    // --- Switch to build mode ---
    await session.mode.switch({ modeId: 'build' });
    streamSpy.mockClear();
    await session.sendMessage({ content: 'Hello in build mode' });

    callArgs = streamSpy.mock.calls[0] as unknown as [any, any];
    streamOptions = callArgs[1];
    // Build mode has no availableTools — activeTools must be undefined
    expect(streamOptions.activeTools).toBeUndefined();

    // The workspace instance must be the same object — mode switching
    // must NOT create a new workspace.
    expect(resolvedWorkspace).toBe(workspaceInPlanMode);
  });

  it('renamed workspace tools are matched by exposed name, not internal name', async () => {
    const workspace = createWorkspace();
    const readOnlyMode: HarnessMode = {
      id: 'readonly',
      name: 'Read Only',
      default: true,
      // Use exposed names (view, find_files) — not internal names
      // (mastra_workspace_read_file, mastra_workspace_list_files)
      availableTools: ['view', 'find_files'],
    };

    const { session, registeredAgent } = await setupHarness({
      modes: [readOnlyMode],
      workspace,
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    const callArgs = streamSpy.mock.calls[0] as unknown as [any, any];
    const streamOptions = callArgs[1];
    // The availableTools list uses exposed names. The model will call tools
    // by their exposed names. activeTools must contain the exposed names,
    // not the internal mastra_workspace_* names.
    expect(streamOptions.activeTools).toEqual(['view', 'find_files']);
    // Internal names must NOT appear in activeTools
    expect(streamOptions.activeTools).not.toContain(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(streamOptions.activeTools).not.toContain(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
  });
});
