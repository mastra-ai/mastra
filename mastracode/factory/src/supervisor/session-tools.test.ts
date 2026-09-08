import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactorySupervisorSessionTools } from './session-tools.js';

const scope = { orgId: 'org-1', factoryProjectId: '11111111-2222-4333-8444-555555555555' };
async function setup({ current = true, busy = false } = {}) {
  const seed = await createFactoryStorageForTests();
  const item = (
    await seed.workItems.upsert({ ...scope, userId: 'person', input: { title: 'Card', stages: ['execute'] } })
  ).item;
  const { binding } = await seed.workItems.prepareRunStart({
    ...scope,
    userId: 'person',
    workItem: { id: item.id, input: { title: item.title, stages: item.stages } },
    role: 'work',
    session: { sessionId: 'session', threadId: 'bound', branch: 'test' },
    resourceId: 'resource',
    kickoffKey: 'kickoff',
    kickoffMessage: null,
  });
  let mode = 'work';
  let model = 'old-model';
  const state: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = { currentModeId: 'work' };
  const omRole = () => {
    let modelId = 'old-om';
    return {
      modelId: () => modelId,
      switchModel: vi.fn(async (input: { modelId: string }) => {
        modelId = input.modelId;
      }),
    };
  };
  const session = {
    thread: {
      getId: () => (current ? 'bound' : 'other'),
      getById: vi.fn(async () => ({ metadata })),
      setSettingOn: vi.fn(async ({ key, value }: { threadId: string; key: string; value: unknown }) => {
        metadata[key] = value;
      }),
      rename: vi.fn(async (_input: { title: string }) => {}),
    },
    run: { isRunning: () => busy },
    mode: {
      get: () => mode,
      switch: vi.fn(async ({ modeId }: { modeId: string }) => {
        mode = modeId;
      }),
    },
    model: {
      get: () => model,
      switch: vi.fn(async ({ modelId }: { modelId: string; scope: 'thread' }) => {
        model = modelId;
      }),
    },
    om: { observer: omRole(), reflector: omRole() },
    state: {
      get: () => state,
      set: vi.fn(async (values: Record<string, unknown>) => {
        Object.assign(state, values);
      }),
    },
  };
  const controller = {
    getSessionByResource: vi.fn(async () => session),
    listModes: () => [{ id: 'work' }, { id: 'plan' }],
  };
  const memorySettings = { get: vi.fn<MemorySettingsStorage['get']>(async () => null) };
  const projects = {
    getById: vi.fn<FactoryProjectsStorage['getById']>(async () => ({
      id: scope.factoryProjectId,
      orgId: scope.orgId,
      createdBy: 'person',
      name: 'Factory',
      description: null,
      defaultModelId: null,
      slackWorkItemsEnabled: false,
      autoRunEnabled: false,
      autoApprovePlans: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
  const tool = createFactorySupervisorSessionTools({
    ...seed,
    scope,
    userId: 'person',
    controller,
    memorySettings,
    projects,
  }).factory_update_session;
  const call = async (input: unknown) => {
    const parsed = (tool.inputSchema as z.ZodType).parse(input);
    return (tool.execute as (input: unknown, context: unknown) => Promise<any>)(parsed, {});
  };
  const audits = async () => (await seed.audit.list({ ...scope, limit: 100 })).events;
  return { ...seed, item, binding, session, controller, memorySettings, projects, tool, call, metadata, audits };
}

describe('factory_update_session', () => {
  it.each([
    { current: true, busy: false, timing: 'now' },
    { current: true, busy: true, timing: 'next-run-start' },
    { current: false, busy: false, timing: 'next-thread-switch' },
  ])('applies the current=$current busy=$busy matrix', async ({ current, busy, timing }) => {
    const c = await setup({ current, busy });
    expect(c.tool.requireApproval).toBe(false);
    const output = await c.call({
      target: { sessionId: 'session' },
      changes: { mode: 'plan', model: 'custom/model', title: 'Retitled', memory: { observationThreshold: 123 } },
    });
    const result = output.results[0];
    expect(result.applied.model).toBe(timing);
    expect(c.controller.getSessionByResource).toHaveBeenCalledWith('resource');
    expect(c.metadata[`modeModelId_${busy ? 'work' : 'plan'}`]).toBe('custom/model');
    if (!current || busy) {
      expect(c.session.model.switch).not.toHaveBeenCalled();
      expect(c.session.mode.switch).not.toHaveBeenCalled();
    } else {
      expect(c.session.model.switch).toHaveBeenCalledWith({ modelId: 'custom/model', scope: 'thread' });
      expect(result.applied.mode).toBe('now');
    }
    if (busy) {
      expect(result.skipped.mode).toBe('session-busy');
      expect(result.skipped.memory).toBe('session-busy');
      expect(c.session.state.set).not.toHaveBeenCalled();
    }
    if (!current) {
      expect(result.applied.mode).toBe('next-thread-switch');
      expect(result.skipped.title).toBe('thread-not-current');
      expect(c.session.thread.rename).not.toHaveBeenCalled();
    } else expect(result.applied.title).toBe('now');
    expect(output.summary).toEqual({ targets: 1, touched: 1, untouched: 0 });
    expect(await c.audits()).toMatchObject([
      {
        actorId: 'person',
        actorType: 'human',
        action: 'factory.supervisor.session_updated',
        metadata: { cause: 'supervisor', applied: result.applied, warnings: result.warnings },
      },
    ]);
  });

  it('rejects forbidden fields and empty changes or memory', async () => {
    const c = await setup();
    for (const changes of [
      {},
      { memory: {} },
      { yolo: true },
      { model: 'x', notifications: true },
      { memory: { permissions: 'all' } },
      { model: ' ' },
      { memory: { observationThreshold: -1 } },
    ]) {
      await expect(c.call({ target: { all: true }, changes })).rejects.toThrow();
    }
    await expect(c.call({ target: { all: true, sessionId: 'session' }, changes: { title: 'x' } })).rejects.toThrow();
  });

  it('targets work item and role, and rejects foreign or revoked sessions', async () => {
    const c = await setup();
    await c.call({ target: { workItemId: c.item.id, role: 'work' }, changes: { title: 'x' } });
    await expect(c.call({ target: { sessionId: 'foreign' }, changes: { title: 'x' } })).rejects.toThrow(
      'Not an active worker session',
    );
    vi.spyOn(c.workItems, 'listRunBindings').mockResolvedValue([{ ...c.binding, status: 'revoked' }]);
    await expect(c.call({ target: { sessionId: 'session' }, changes: { title: 'x' } })).rejects.toThrow(
      'Not an active worker session',
    );
    expect((await c.call({ target: { all: true }, changes: { title: 'x' } })).summary.targets).toBe(0);
  });

  it('reports deleted work items and non-live sessions without audit or writes', async () => {
    const c = await setup();
    const getItem = vi.spyOn(c.workItems, 'getForProject').mockResolvedValueOnce(null);
    expect((await c.call({ target: { all: true }, changes: { model: 'new' } })).results[0].skipReason).toBe(
      'work-item-gone',
    );
    expect(c.controller.getSessionByResource).not.toHaveBeenCalled();
    getItem.mockRestore();
    c.controller.getSessionByResource.mockResolvedValueOnce(undefined!);
    expect((await c.call({ target: { all: true }, changes: { model: 'new' } })).results[0].skipReason).toBe(
      'session-not-live',
    );
    expect(await c.audits()).toEqual([]);
  });

  it('skips unknown mode but writes model against the existing mode', async () => {
    const c = await setup();
    const { results } = await c.call({ target: { all: true }, changes: { mode: 'unknown', model: 'new' } });
    expect(results[0].skipped.mode).toBe('unknown-mode');
    expect(c.metadata.modeModelId_work).toBe('new');
  });

  it.each([false, true])('reports a failed live model switch honestly when mutation=%s', async mutated => {
    const c = await setup();
    const original = c.session.model.switch.getMockImplementation()!;
    c.session.model.switch.mockImplementationOnce(async args => {
      if (mutated) await original(args);
      throw new Error('persistence failed');
    });
    const { results } = await c.call({ target: { all: true }, changes: { model: 'new' } });
    expect(results[0].applied.model).toBe(mutated ? 'now' : 'next-run-start');
    expect(results[0].warnings[0]).toContain('persistence failed');
    expect((await c.audits())[0].metadata).toMatchObject({ warnings: results[0].warnings });
  });

  it('reports mode mutation before a throw, then applies model to that mode', async () => {
    const c = await setup();
    const original = c.session.mode.switch.getMockImplementation()!;
    c.session.mode.switch.mockImplementationOnce(async args => {
      await original(args);
      throw new Error('persist failed');
    });
    const { results } = await c.call({ target: { all: true }, changes: { mode: 'plan', model: 'new' } });
    expect(results[0].applied).toEqual({ mode: 'now', model: 'now' });
    expect(results[0].warnings[0]).toContain('persistence or incoming-model reconciliation failed');
    expect(c.metadata.modeModelId_plan).toBe('new');
  });

  it('resyncs defaults per knob and reports already-matching state unchanged', async () => {
    const c = await setup();
    const first = await c.call({ target: { all: true }, changes: { memory: 'resync' } });
    expect(first.results[0].applied.memory).toEqual({
      observerModelId: 'written',
      reflectorModelId: 'written',
      observationThreshold: 'written',
      reflectionThreshold: 'written',
      observeAttachments: 'unchanged',
    });
    expect(c.session.state.get()).toMatchObject({ observationThreshold: 30000, reflectionThreshold: 40000 });
    expect(c.memorySettings.get).toHaveBeenCalledWith({
      orgId: scope.orgId,
      userId: `factory-project:${scope.factoryProjectId}`,
    });
    const second = await c.call({ target: { all: true }, changes: { memory: 'resync' } });
    expect(Object.values(second.results[0].applied.memory)).toEqual(Array(5).fill('unchanged'));
    expect(c.session.om.observer.switchModel).toHaveBeenCalledTimes(1);
  });

  it('continues model updates when resync fails and reuses the failure for a shared session', async () => {
    const c = await setup();
    vi.spyOn(c.workItems, 'listRunBindings').mockResolvedValue([
      c.binding,
      { ...c.binding, id: 'second', threadId: 'second', role: 'review' },
    ]);
    c.memorySettings.get.mockRejectedValueOnce(new Error('storage unavailable'));
    const { results } = await c.call({ target: { all: true }, changes: { model: 'new', memory: 'resync' } });
    expect(results.map((r: any) => r.skipped.memory)).toEqual(['storage unavailable', 'storage unavailable']);
    expect(results.map((r: any) => r.applied.model)).toEqual(['now', 'next-thread-switch']);
    expect(c.memorySettings.get).toHaveBeenCalledTimes(1);
  });

  it('does not switch after the session becomes busy during persistence', async () => {
    const c = await setup();
    c.session.thread.setSettingOn.mockImplementationOnce(async () => {
      c.session.run.isRunning = () => true;
    });
    const { results } = await c.call({ target: { all: true }, changes: { model: 'new' } });
    expect(results[0].applied.model).toBe('next-run-start');
    expect(c.session.model.switch).not.toHaveBeenCalled();
  });

  it('reports partial memory application per knob and deduplicates shared resource updates', async () => {
    const c = await setup();
    vi.spyOn(c.workItems, 'listRunBindings').mockResolvedValue([
      c.binding,
      { ...c.binding, id: 'second', threadId: 'second', role: 'review' },
    ]);
    c.session.om.reflector.switchModel.mockRejectedValueOnce(new Error('reflector failed'));
    const { results, summary } = await c.call({
      target: { sessionId: 'session' },
      changes: { memory: { observerModelId: 'new', reflectorModelId: 'new', observationThreshold: 123 } },
    });
    expect(summary).toEqual({ targets: 2, touched: 2, untouched: 0 });
    expect(results[0].applied.memory).toEqual({ observerModelId: 'written', observationThreshold: 'written' });
    expect(results[0].skipped.memory).toEqual({ reflectorModelId: 'reflector failed' });
    expect(results[1].applied.memory).toEqual(results[0].applied.memory);
    expect(c.session.om.observer.switchModel).toHaveBeenCalledTimes(1);
    expect(c.session.om.reflector.switchModel).toHaveBeenCalledTimes(1);
    expect(await c.audits()).toHaveLength(2);
  });
});
