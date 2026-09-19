import { describe, it, expect, vi } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import {
  browserViewerCommandSchema,
  resolveControllerBrowser,
  STREAM_AGENT_CONTROLLER_BROWSER_ROUTE,
} from './agent-controller-browser';

function fixture() {
  const release = vi.fn(async () => {});
  let emit: (event: any) => void = () => {};
  const viewer = {
    subscribe: vi.fn(async (listener: typeof emit) => {
      emit = listener;
      return release;
    }),
  };
  const browser = {
    isBrowserRunning: () => true,
    getActivityState: () => ({ incarnation: 'one' }),
    getViewer: () => viewer,
  };
  const session = {
    identity: { getResourceId: () => 'user:a' },
    thread: { getId: () => 'thread-a', getById: vi.fn(async () => ({ resourceId: 'user:a' })) },
    browser,
  };
  const controller = { getSessionByResource: vi.fn(async () => session), createSession: vi.fn() };
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user:a');
  const args = {
    mastra: { getAgentController: () => controller },
    controllerId: 'code',
    resourceId: 'user:a',
    sessionThreadId: 'thread-a',
    sessionScope: 'thread:thread-a',
    incarnation: 'one',
    requestContext,
  };
  return { args, controller, session, release, emit: (event: any) => emit(event) };
}

describe('exact session browser routes', () => {
  it('never creates a session while watching', async () => {
    const { args, controller } = fixture();
    await resolveControllerBrowser(args as any);
    expect(controller.getSessionByResource).toHaveBeenCalledWith('user:a', 'thread:thread-a');
    expect(controller.createSession).not.toHaveBeenCalled();
    controller.getSessionByResource.mockResolvedValueOnce(undefined as never);
    await expect(resolveControllerBrowser(args as any)).rejects.toMatchObject({ status: 404 });
    expect(controller.createSession).not.toHaveBeenCalled();
  });

  it.each([{ resourceId: 'user:b' }, { sessionThreadId: 'thread-b' }, { incarnation: 'previous' }])(
    'rejects mismatched identity %j',
    async mismatch => {
      const { args } = fixture();
      await expect(resolveControllerBrowser({ ...args, ...mismatch } as any)).rejects.toMatchObject({ status: 404 });
    },
  );

  it('checks persisted ownership as well as live identity', async () => {
    const { args, session } = fixture();
    session.thread.getById.mockResolvedValueOnce({ resourceId: 'user:b' });
    await expect(resolveControllerBrowser(args as any)).rejects.toMatchObject({ status: 404 });
  });

  it('retains only the newest waiting frame and releases on cancellation', async () => {
    const { args, release, emit } = fixture();
    const stream = (await STREAM_AGENT_CONTROLLER_BROWSER_ROUTE.handler(args as any)) as ReadableStream<any>;
    for (let i = 0; i < 100; i++)
      emit({ type: 'frame', data: String(i), format: 'png', viewport: { width: 1, height: 1 } });
    const reader = stream.getReader();
    expect((await reader.read()).value.data).toBe('0');
    expect((await reader.read()).value.data).toBe('99');
    await reader.cancel();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('cleans up a connection aborted during subscription', async () => {
    const { args, release } = fixture();
    const abort = new AbortController();
    const pending = STREAM_AGENT_CONTROLLER_BROWSER_ROUTE.handler({ ...args, abortSignal: abort.signal } as any);
    abort.abort();
    const stream = (await pending) as ReadableStream<any>;
    expect((await stream.getReader().read()).done).toBe(true);
    expect(release.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('rejects invalid geometry, navigation and input', () => {
    expect(
      browserViewerCommandSchema.safeParse({
        type: 'preferences',
        preferences: { width: 0, height: 900, deviceScaleFactor: 8, locale: 'bad_locale' },
      }).success,
    ).toBe(false);
    expect(browserViewerCommandSchema.safeParse({ type: 'navigate', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(browserViewerCommandSchema.safeParse({ type: 'text', text: 'a'.repeat(65537) }).success).toBe(false);
  });
});
