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

describe('Session.models accessors', () => {
  it('returns the current model from the record', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'gpt-5',
    });

    expect(session.models.current()).toBe('gpt-5');
  });

  it('tracks whether any top-level or subagent model was selected', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(session.models.hasSelected()).toBe(false);

    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5-mini' });
    expect(session.models.hasSelected()).toBe(true);
  });

  it("returns unknown auth status when no model is selected or the model isn't cataloged", async () => {
    const { harness } = setup({ models: [{ id: 'authed/model', providerId: 'authed' }] });
    const empty = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(await empty.models.currentAuthStatus()).toBe('unknown');

    const uncataloged = await harness.session({
      resourceId: 'u2',
      threadId: { fresh: true },
      modelId: 'not-in-catalog',
    });
    expect(await uncataloged.models.currentAuthStatus()).toBe('unknown');
  });

  it('delegates currentAuthStatus to the harness catalog', async () => {
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
  it('persists the new model id and emits model_changed', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'old',
    });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.models.switch({ model: 'new' });

    expect(session.models.current()).toBe('new');
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({ modelId: 'new' });
    expect(events.find(event => event.type === 'model_changed')).toMatchObject({
      type: 'model_changed',
      modelId: 'new',
      previousModelId: 'old',
    });
  });

  it('is a no-op when switching to the same model id', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'same',
    });
    const version = session._internalRecordVersion;
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.models.switch({ model: 'same' });

    expect(session._internalRecordVersion).toBe(version);
    expect(events.some(event => event.type === 'model_changed')).toBe(false);
  });

  it('rejects empty model strings', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.models.switch({ model: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session.models subagent overrides', () => {
  it('persists the override and reads it back', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5-mini' });

    expect(session.models.getSubagent({ agentType: 'researcher' })).toBe('gpt-5-mini');
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({
      subagentModelOverrides: { researcher: 'gpt-5-mini' },
    });
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
    session.subscribe(event => {
      events.push(event);
    });

    await session.models.setSubagent({ agentType: 'researcher', model: 'v1' });
    await session.models.setSubagent({ agentType: 'researcher', model: 'v2' });

    const overrideEvents = events.filter(event => event.type === 'model_override_set');
    expect(overrideEvents).toHaveLength(2);
    expect(overrideEvents[0]).toMatchObject({ agentType: 'researcher', modelId: 'v1', previousModelId: null });
    expect(overrideEvents[1]).toMatchObject({ agentType: 'researcher', modelId: 'v2', previousModelId: 'v1' });
  });

  it('is a no-op when setting the same agentType to the same model', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5' });
    const version = session._internalRecordVersion;

    await session.models.setSubagent({ agentType: 'researcher', model: 'gpt-5' });

    expect(session._internalRecordVersion).toBe(version);
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
