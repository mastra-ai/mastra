import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import type {
  ConfigSelectorOptions,
  ObservabilityEntrypoint,
  ObservabilityInstance,
  WorkspaceActivityEvent,
} from '../observability';
import { LocalFilesystem } from '../workspace/filesystem';
import { LocalSandbox } from '../workspace/sandbox';
import { Workspace } from '../workspace/workspace';
import { Mastra } from './index';

/**
 * Build a minimal `ObservabilityEntrypoint` that returns a single default
 * instance. The instance records emitted workspace_activity events so tests
 * can verify that auto-instrumentation kicked in.
 */
function makeObservabilityInstance(): {
  instance: ObservabilityInstance;
  activity: WorkspaceActivityEvent[];
} {
  const activity: WorkspaceActivityEvent[] = [];
  const instance: ObservabilityInstance = {
    getConfig: () => ({}) as any,
    getExporters: () => [],
    getSpanOutputProcessors: () => [],
    getLogger: () => ({}) as any,
    getBridge: () => undefined,
    // Minimal fake span: only the surface the wrapper touches.
    startSpan: (opts: any) =>
      ({
        id: `span-${Math.random().toString(36).slice(2)}`,
        traceId: `trace-${Math.random().toString(36).slice(2)}`,
        name: opts?.name ?? 'span',
        isValid: true,
        end: () => {},
        error: () => {},
        createChildSpan: (_c: any) => ({}) as any,
      }) as any,
    rebuildSpan: () => ({}) as any,
    flush: async () => {},
    shutdown: async () => {},
    __setLogger: () => {},
    // No getLoggerContext/getMetricsContext — wrapper must handle missing hooks.
    emitWorkspaceActivityEvent: (event: WorkspaceActivityEvent) => {
      activity.push(event);
    },
  };
  return { instance, activity };
}

function makeObservabilityEntrypoint(): {
  entrypoint: ObservabilityEntrypoint;
  activity: WorkspaceActivityEvent[];
  swapDefaultInstance: (next: ObservabilityInstance) => void;
} {
  const { instance: firstInstance, activity } = makeObservabilityInstance();
  let currentInstance: ObservabilityInstance = firstInstance;
  const instances = new Map<string, ObservabilityInstance>([['default', firstInstance]]);

  const entrypoint: ObservabilityEntrypoint = {
    flush: async () => {},
    shutdown: async () => {},
    setMastraContext: () => {},
    setLogger: () => {},
    getSelectedInstance: (_options: ConfigSelectorOptions) => currentInstance,
    registerInstance: (name: string, ins: ObservabilityInstance) => {
      instances.set(name, ins);
    },
    getInstance: (name: string) => instances.get(name),
    getDefaultInstance: () => currentInstance,
    listInstances: () => instances,
    unregisterInstance: (name: string) => instances.delete(name),
    hasInstance: (name: string) => instances.has(name),
    setConfigSelector: () => {},
    clear: () => {},
  };

  return {
    entrypoint,
    activity,
    swapDefaultInstance: (next: ObservabilityInstance) => {
      currentInstance = next;
      instances.set('default', next);
    },
  };
}

describe('Mastra workspace observability auto-instrumentation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-obs-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const createWorkspace = (opts: { withSandbox?: boolean } = {}) =>
    new Workspace({
      id: 'ws-obs',
      name: 'workspace-obs',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      ...(opts.withSandbox ? { sandbox: new LocalSandbox({ workDir: tempDir }) } : {}),
    });

  it('returns the raw provider when the workspace has no Mastra parent', () => {
    const ws = createWorkspace();
    const raw = (ws as any)._fs;
    expect(ws.filesystem).toBe(raw);
  });

  it('returns the raw provider when Mastra has no observability configured', () => {
    const ws = createWorkspace();
    const mastra = new Mastra({ logger: false });
    mastra.addWorkspace(ws);

    const raw = (ws as any)._fs;
    expect(ws.filesystem).toBe(raw);
  });

  it('wraps the filesystem provider when Mastra has observability configured', async () => {
    const ws = createWorkspace();
    const { entrypoint, activity } = makeObservabilityEntrypoint();
    const mastra = new Mastra({ logger: false, observability: entrypoint });
    mastra.addWorkspace(ws);

    const raw = (ws as any)._fs;
    const wrapped = ws.filesystem;
    expect(wrapped).not.toBe(raw);

    // Consecutive reads return the same Proxy (memoized).
    expect(ws.filesystem).toBe(wrapped);

    // Calling through the Proxy exercises instrumentation and reaches the raw provider.
    await wrapped!.writeFile('hello.txt', 'world');
    expect(activity.some(e => e.type === 'filesystem_change')).toBe(true);
  });

  it('registration is idempotent: re-adding the same workspace does not double-wrap or throw', async () => {
    const ws = createWorkspace();
    const { entrypoint } = makeObservabilityEntrypoint();
    const mastra = new Mastra({ logger: false, observability: entrypoint });
    mastra.addWorkspace(ws);
    const firstProxy = ws.filesystem;

    expect(() => mastra.addWorkspace(ws)).not.toThrow();
    expect(ws.filesystem).toBe(firstProxy);
  });

  it('wraps sandbox and filesystem on an agent-owned workspace via Agent.__registerMastra fanout', () => {
    const ws = createWorkspace({ withSandbox: true });
    const agent = new Agent({
      name: 'A',
      instructions: 'test',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1 },
          text: 'ok',
        }),
      }),
      workspace: ws,
    });

    const { entrypoint } = makeObservabilityEntrypoint();
    const mastra = new Mastra({
      logger: false,
      observability: entrypoint,
      agents: { A: agent },
    });
    // Silence unused-var: mastra is constructed for its side-effect (auto-register agent + workspace).
    void mastra;

    const rawFs = (ws as any)._fs;
    expect(ws.filesystem).not.toBe(rawFs);

    const rawSb = (ws as any)._sandbox;
    expect(ws.sandbox).not.toBe(rawSb);
  });

  it('rebuilds the wrapped provider when the selected observability instance changes', () => {
    const ws = createWorkspace();
    const { entrypoint, swapDefaultInstance } = makeObservabilityEntrypoint();
    const mastra = new Mastra({ logger: false, observability: entrypoint });
    mastra.addWorkspace(ws);

    const firstProxy = ws.filesystem;
    const raw = (ws as any)._fs;
    expect(firstProxy).not.toBe(raw);

    // Reading again with the same instance returns the same Proxy (memoized).
    expect(ws.filesystem).toBe(firstProxy);

    // Swap in a different observability instance — the cache entry must
    // be invalidated because the old Proxy closes over the previous instance.
    const { instance: nextInstance } = makeObservabilityInstance();
    swapDefaultInstance(nextInstance);

    const secondProxy = ws.filesystem;
    expect(secondProxy).not.toBe(raw);
    expect(secondProxy).not.toBe(firstProxy);
  });
});
