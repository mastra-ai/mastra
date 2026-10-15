import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { readFactoryThinkingLevel, resolveFactoryThinkingLevel } from './thinking-default.js';

const FACTORY_ID = '11111111-1111-4111-8111-111111111111';

function contextFor(controller: Record<string, unknown> | undefined) {
  const requestContext = new RequestContext();
  if (controller) requestContext.set('controller', controller);
  return requestContext;
}

function deps({ sessionFactoryId }: { sessionFactoryId?: string } = {}) {
  return {
    projects: {
      getById: vi.fn(async ({ id }: { id: string }) =>
        id === FACTORY_ID ? ({ id, defaultThinkingLevel: 'high' } as never) : null,
      ),
    },
    sourceControl: {
      getBySessionId: vi.fn(async () => (sessionFactoryId ? ({ factoryProjectId: sessionFactoryId } as never) : null)),
    },
  };
}

describe('resolveFactoryThinkingLevel', () => {
  it("uses the default stored on a session's Factory", async () => {
    const level = await resolveFactoryThinkingLevel(
      contextFor({ resourceId: 'session-1' }),
      deps({ sessionFactoryId: FACTORY_ID }),
    );
    expect(level).toBe('high');
  });

  it('reads the Factory from session state when no source-control session exists', async () => {
    const level = await resolveFactoryThinkingLevel(
      contextFor({ resourceId: 'session-1', getState: () => ({ factoryProjectId: FACTORY_ID }) }),
      deps(),
    );
    expect(level).toBe('high');
  });

  it('resolves Factory-page requests by their resource id', async () => {
    expect(await resolveFactoryThinkingLevel(contextFor({ resourceId: FACTORY_ID }), deps())).toBe('high');
  });

  it('uses off outside any Factory and when the lookup fails', async () => {
    expect(await resolveFactoryThinkingLevel(contextFor(undefined), deps())).toBe('off');
    expect(await resolveFactoryThinkingLevel(contextFor({ resourceId: 'user-1' }), deps())).toBe('off');

    const failing = deps();
    failing.sourceControl.getBySessionId.mockRejectedValue(new Error('domain not ready'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await resolveFactoryThinkingLevel(contextFor({ resourceId: 'session-1' }), failing)).toBe('off');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('readFactoryThinkingLevel', () => {
  it('reads the level stored on the given Factory', async () => {
    expect(await readFactoryThinkingLevel(deps().projects, FACTORY_ID)).toBe('high');
  });

  it('uses off when the Factory is missing or the lookup fails', async () => {
    expect(await readFactoryThinkingLevel(deps().projects, 'missing')).toBe('off');

    const failing = deps();
    failing.projects.getById.mockRejectedValue(new Error('domain not ready'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await readFactoryThinkingLevel(failing.projects, FACTORY_ID)).toBe('off');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
