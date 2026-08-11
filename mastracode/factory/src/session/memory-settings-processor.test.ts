import { MessageList } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { FactoryMemorySettingsProcessor } from './memory-settings-processor.js';

const TENANT = { orgId: 'org-1', userId: 'user-1' };

let seed: FactoryStorageTestSeed;

function requestContext(options: { authenticated?: boolean; scope?: string } = {}) {
  const context = new RequestContext();
  if (options.authenticated !== false) {
    context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  }
  context.set('controller', { resourceId: 'resource-1', threadId: 'thread-1', scope: options.scope });
  return context;
}

function sessionDouble(models: { observer: string; reflector: string }) {
  const current = { ...models };
  return {
    om: {
      observer: {
        modelId: () => current.observer,
        switchModel: vi.fn(async ({ modelId }: { modelId: string }) => void (current.observer = modelId)),
      },
      reflector: {
        modelId: () => current.reflector,
        switchModel: vi.fn(async ({ modelId }: { modelId: string }) => void (current.reflector = modelId)),
      },
    },
    state: { get: () => ({ observationThreshold: 30_000, reflectionThreshold: 40_000 }), set: vi.fn(async () => {}) },
  };
}

function buildProcessor(
  session: ReturnType<typeof sessionDouble> | undefined,
  options: { authEnabled?: boolean } = {},
) {
  const getSessionByResource = vi.fn(async () => session);
  const processor = new FactoryMemorySettingsProcessor({
    memorySettings: seed.memorySettings,
    getController: () => ({ getSessionByResource }),
    authEnabled: options.authEnabled ?? true,
  });
  return { processor, getSessionByResource };
}

const run = (processor: FactoryMemorySettingsProcessor, context: RequestContext) =>
  processor.processInput({ messageList: new MessageList(), requestContext: context });

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
});

describe('FactoryMemorySettingsProcessor', () => {
  it('moves a live session onto the model the user picked after it started', async () => {
    await seed.memorySettings.patch({ ...TENANT, patch: { observerModelId: 'anthropic/claude-haiku-4-5' } });
    const session = sessionDouble({ observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' });
    const { processor } = buildProcessor(session);

    await run(processor, requestContext());

    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-haiku-4-5' });
  });

  it('stops writing once the session already matches the stored row', async () => {
    await seed.memorySettings.patch({ ...TENANT, patch: { observerModelId: 'anthropic/claude-haiku-4-5' } });
    const session = sessionDouble({ observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' });
    const { processor } = buildProcessor(session);

    await run(processor, requestContext());
    await run(processor, requestContext());

    expect(session.om.observer.switchModel).toHaveBeenCalledTimes(1);
  });

  it('resets a session restored with a stale model when the row holds no choice', async () => {
    const session = sessionDouble({ observer: 'openai/gpt-5.6', reflector: 'openai/gpt-5.6' });
    const { processor } = buildProcessor(session);

    await run(processor, requestContext());

    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'google/gemini-3.5-flash' });
  });

  it('reads the sentinel local row when auth is disabled', async () => {
    await seed.memorySettings.patch({
      orgId: 'local',
      userId: 'local',
      patch: { observerModelId: 'anthropic/claude-haiku-4-5', reflectorModelId: 'anthropic/claude-haiku-4-5' },
    });
    const session = sessionDouble({ observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' });
    const { processor } = buildProcessor(session, { authEnabled: false });

    await run(processor, requestContext({ authenticated: false }));

    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-haiku-4-5' });
  });

  it('leaves the session alone when auth is on but the caller is unidentified', async () => {
    const session = sessionDouble({ observer: 'openai/gpt-5.6', reflector: 'openai/gpt-5.6' });
    const { processor, getSessionByResource } = buildProcessor(session);

    await run(processor, requestContext({ authenticated: false }));

    expect(getSessionByResource).not.toHaveBeenCalled();
    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
  });

  it('passes the isolation scope through so the right session is found', async () => {
    const session = sessionDouble({ observer: 'google/gemini-3.5-flash', reflector: 'google/gemini-3.5-flash' });
    const { processor, getSessionByResource } = buildProcessor(session);

    await run(processor, requestContext({ scope: '/worktree' }));

    expect(getSessionByResource).toHaveBeenCalledWith('resource-1', '/worktree');
  });

  it('returns cleanly when no session is live for the resource', async () => {
    const { processor } = buildProcessor(undefined);

    await expect(run(processor, requestContext())).resolves.toBeDefined();
  });
});
