import type { Mastra } from '@mastra/core';
import { describe, it, expect, vi } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { createPersistAgentStep } from '../index';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

type RequestContextStub = { get: (key: string) => unknown };

function runStep(config: Config, mastra: Mastra, requestContext?: RequestContextStub) {
  const step = createPersistAgentStep({ model: 'openai/gpt-5.5' });
  return (
    step.execute as (args: { inputData: Config; mastra: Mastra; requestContext?: RequestContextStub }) => Promise<any>
  )({
    inputData: config,
    mastra,
    requestContext,
  });
}

describe('persist-agent step', () => {
  it('creates the stored agent with the mapped config and returns the result', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({
        agent: { create },
        // No builder ⇒ availability resolvers degrade gracefully.
      }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = {
      userOutcome,
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      model: { provider: 'openai', name: 'gpt-5.5' },
      tools: { t1: true },
    };

    const result = await runStep(config, mastra);

    expect(create).toHaveBeenCalledTimes(1);
    const createInput = create.mock.calls[0][0];
    expect(createInput).toMatchObject({
      name: 'Helper',
      description: 'A helper',
      instructions: 'Do things',
      visibility: 'private',
      model: { provider: 'openai', name: 'gpt-5.5' },
      tools: { t1: {} },
    });
    expect(typeof createInput.id).toBe('string');
    expect(createInput.requestContextSchema).toBeDefined();

    expect(result.id).toBe(createInput.id);
    expect(result.visibility).toBe('private');
    expect(result.config.name).toBe('Helper');
  });

  it("sets authorId from the request context 'user' key", async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    const requestContext: RequestContextStub = {
      get: key => (key === 'user' ? { id: 'user-1' } : undefined),
    };

    const result = await runStep(config, mastra, requestContext);

    const createInput = create.mock.calls[0][0];
    expect(createInput.authorId).toBe('user-1');
    expect(createInput.visibility).toBe('private');
    expect(result.visibility).toBe('private');
  });

  it('omits authorId when no user is on the request context', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };

    // No request context at all.
    await runStep(config, mastra);
    expect(create.mock.calls[0][0].authorId).toBeUndefined();
    expect(create.mock.calls[0][0].visibility).toBe('private');
  });

  it('omits authorId when the user id is empty or non-string', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };

    await runStep(config, mastra, { get: key => (key === 'user' ? { id: '' } : undefined) });
    expect(create.mock.calls[0][0].authorId).toBeUndefined();

    create.mockClear();
    await runStep(config, mastra, { get: key => (key === 'user' ? { id: 123 } : undefined) });
    expect(create.mock.calls[0][0].authorId).toBeUndefined();
  });

  it('always persists a non-empty model when the config has none', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    await runStep(config, mastra);

    const createInput = create.mock.calls[0][0];
    expect(createInput.model).toBeDefined();
    expect(typeof createInput.model.provider).toBe('string');
    expect(typeof createInput.model.name).toBe('string');
  });

  it('throws when the editor agent namespace is unavailable', async () => {
    const mastra = { getEditor: () => undefined } as unknown as Mastra;
    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    await expect(runStep(config, mastra)).rejects.toThrow(/editor agent namespace is unavailable/);
  });

  it('publishes the initial version after create', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const clearCache = vi.fn();
    const listVersions = vi.fn().mockResolvedValue({ versions: [{ id: 'version-1' }] });
    const update = vi.fn().mockResolvedValue(undefined);
    const getStore = vi.fn().mockResolvedValue({ listVersions, update });
    const mastra = {
      getEditor: () => ({ agent: { create, clearCache } }),
      getStorage: () => ({ getStore }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    const result = await runStep(config, mastra);

    expect(getStore).toHaveBeenCalledWith('agents');
    expect(listVersions).toHaveBeenCalledWith({ agentId: result.id, perPage: 1 });
    expect(update).toHaveBeenCalledWith({ id: result.id, activeVersionId: 'version-1', status: 'published' });
    expect(clearCache).toHaveBeenCalledWith(result.id);
  });

  it('completes without throwing when versioning is unavailable', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    // Storage present but the agents store lacks versioning APIs.
    const getStore = vi.fn().mockResolvedValue({});
    const mastra = {
      getEditor: () => ({ agent: { create } }),
      getStorage: () => ({ getStore }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    const result = await runStep(config, mastra);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.id).toBeDefined();
  });

  it('does not publish when no initial version exists', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'created' });
    const clearCache = vi.fn();
    const listVersions = vi.fn().mockResolvedValue({ versions: [] });
    const update = vi.fn().mockResolvedValue(undefined);
    const getStore = vi.fn().mockResolvedValue({ listVersions, update });
    const mastra = {
      getEditor: () => ({ agent: { create, clearCache } }),
      getStorage: () => ({ getStore }),
      listGateways: () => undefined,
    } as unknown as Mastra;

    const config: Config = { userOutcome, name: 'Helper', instructions: 'Do things' };
    await runStep(config, mastra);

    expect(update).not.toHaveBeenCalled();
    expect(clearCache).not.toHaveBeenCalled();
  });
});
