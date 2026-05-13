/**
 * Harness v1 — Session.models.* namespace (§4.2a).
 *
 * Covers the resolved-model accessor, the auth-status delegation through
 * `harness.models.getAuthStatus`, the subagent-pinning setters, and event
 * emission on mutation.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

function makeAgent(name: string) {
  return new Agent({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
}

function setup(opts?: { models?: { id: string; providerId: string }[] }) {
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { a: makeAgent('a') } as any,
    modes: [{ id: 'm', agentId: 'a' }],
    defaultModeId: 'm',
    sessions: { storage },
    ...(opts?.models
      ? {
          models: opts.models,
          modelAuthStatusResolver: (id: string) => (id === 'authed/model' ? 'authenticated' : 'needs_auth'),
        }
      : {}),
  });
  return { harness, storage };
}

describe('Session.models — accessors', () => {
  it('current() returns the resolved modelId from the record', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'gpt-5',
    });
    expect(session.models.current()).toBe('gpt-5');
  });

  it('hasSelected() is false on a fresh session with no modelId or overrides', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(session.models.hasSelected()).toBe(false);
  });

  it('hasSelected() is true after switch()', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.models.switch({ model: 'gpt-5' });
    expect(session.models.hasSelected()).toBe(true);
  });

  it('hasSelected() is true after setSubagent() even with no top-level model', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5-mini' });
    expect(session.models.hasSelected()).toBe(true);
  });
});

describe('Session.models.currentAuthStatus', () => {
  it("returns 'unknown' when no model is selected", async () => {
    const { harness } = setup({ models: [{ id: 'authed/model', providerId: 'authed' }] });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(await session.models.currentAuthStatus()).toBe('unknown');
  });

  it("returns 'unknown' when the resolved model isn't in the harness catalog", async () => {
    const { harness } = setup({ models: [{ id: 'authed/model', providerId: 'authed' }] });
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'not-in-catalog',
    });
    expect(await session.models.currentAuthStatus()).toBe('unknown');
  });

  it('delegates to harness.models.getAuthStatus when the model is in the catalog', async () => {
    const { harness } = setup({
      models: [
        { id: 'authed/model', providerId: 'authed' },
        { id: 'unauthed/model', providerId: 'unauthed' },
      ],
    });
    const authed = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'authed/model',
    });
    expect(await authed.models.currentAuthStatus()).toBe('authenticated');

    const unauthed = await harness.session({
      resourceId: 'u2',
      threadId: { fresh: true },
      modelId: 'unauthed/model',
    });
    expect(await unauthed.models.currentAuthStatus()).toBe('needs_auth');
  });
});

describe('Session.models.switch', () => {
  it('emits model_changed with the previous model id', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'old',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.models.switch({ model: 'new' });
    const evt = events.find(e => e.type === 'model_changed');
    expect(evt).toMatchObject({ type: 'model_changed', modelId: 'new', previousModelId: 'old' });
  });

  it('is a no-op when switching to the same model id', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'same',
    });
    const v = session._internalRecordVersion;
    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.models.switch({ model: 'same' });
    expect(session._internalRecordVersion).toBe(v);
    expect(events.some(e => e.type === 'model_changed')).toBe(false);
  });

  it('rejects empty model strings', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await expect(session.models.switch({ model: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session.models.setSubagent / getSubagent', () => {
  it('persists the override and reads it back', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5-mini' });
    expect(session.models.getSubagent({ agentType: 'researcher' })).toBe('gpt-5-mini');

    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored?.subagentModelOverrides).toEqual({ researcher: 'gpt-5-mini' });
  });

  it('returns null for an unset agentType', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(session.models.getSubagent({ agentType: 'unset' })).toBeNull();
  });

  it('emits model_override_set with previousModelId', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.models.setSubagent({ agentType: 'researcher', model: 'v1' });
    await session.models.setSubagent({ agentType: 'researcher', model: 'v2' });
    const overrideEvents = events.filter(e => e.type === 'model_override_set');
    expect(overrideEvents).toHaveLength(2);
    expect(overrideEvents[0]).toMatchObject({ agentType: 'researcher', modelId: 'v1', previousModelId: null });
    expect(overrideEvents[1]).toMatchObject({ agentType: 'researcher', modelId: 'v2', previousModelId: 'v1' });
  });

  it('is a no-op when setting the same agentType to the same model', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5' });
    const v = session._internalRecordVersion;
    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5' });
    expect(session._internalRecordVersion).toBe(v);
  });

  it('rejects empty agentType or model strings', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await expect(session.models.setSubagent({ agentType: '', model: 'm' })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    await expect(session.models.setSubagent({ agentType: 'a', model: '' })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    expect(() => session.models.getSubagent({ agentType: '' })).toThrow(HarnessValidationError);
  });
});
