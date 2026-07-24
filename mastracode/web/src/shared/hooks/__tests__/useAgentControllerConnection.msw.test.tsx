// @vitest-environment jsdom
import type { AgentControllerEvent } from '@mastra/client-js';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { queryKeys } from '../../api/keys';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import {
  deriveConnectionStatus,
  useAgentControllerConnection,
} from '../../../web/ui/domains/chat/hooks/useAgentControllerConnection';
import { reconnectRefetchInterval } from '../useAgentControllerSessionSync';

const controllerId = 'code';
const resourceId = 'resource-test';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = { agentControllerId: controllerId, resourceId, baseUrl: TEST_BASE_URL, enabled: true };

describe('useAgentControllerConnection', () => {
  it('given a session, when the connection is established, then status is ready with session state exposed', async () => {
    const onCreate = vi.fn();
    const onReadState = vi.fn();
    const onStream = vi.fn();
    const onEvent = vi.fn();
    const observedStatuses: string[] = [];
    let releaseState: (() => void) | undefined;
    const stateGate = new Promise<void>(resolve => {
      releaseState = resolve;
    });

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () => {
        onCreate();
        return HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' });
      }),
      http.get(sessionUrl, async () => {
        onReadState();
        await stateGate;
        return HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
      http.get(`${sessionUrl}/stream`, () => {
        onStream();
        return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { result } = renderHookWithProviders(() => {
      const connection = useAgentControllerConnection({ ...hookArgs, onEvent });

      useEffect(() => {
        observedStatuses.push(connection.status);
      }, [connection.status]);

      return connection;
    });

    await waitFor(
      () => {
        expect(onCreate).toHaveBeenCalled();
        expect(onReadState).toHaveBeenCalled();
        expect(result.current.threadId).toBe('created-thread');
      },
      { timeout: 2000 },
    );

    releaseState?.();

    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 2000 });

    expect(result.current.threadId).toBe('state-thread');
    expect(observedStatuses).toContain('connecting');
    expect(observedStatuses).not.toContain('reconnecting');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onReadState).toHaveBeenCalledTimes(1);
    expect(onStream).toHaveBeenCalledTimes(1);
  });

  it('given a repository session, when the connection initializes, then its project identity is persisted to controller state', async () => {
    let receivedState: unknown;
    const onEvent = vi.fn();

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.put(`${sessionUrl}/state`, async ({ request }) => {
        receivedState = await request.json();
        return HttpResponse.json({ ok: true });
      }),
      http.get(sessionUrl, () =>
        HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.get(
        `${sessionUrl}/stream`,
        () =>
          new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    );

    const factorySessionState = {
      factoryProjectId: 'factory-project-1',
      projectRepositoryId: 'project-repository-1',
      sandboxId: 'sandbox-1',
      sandboxWorkdir: '/sandbox/repo',
    };
    const { result } = renderHookWithProviders(() =>
      useAgentControllerConnection({
        ...hookArgs,
        scope: '/sandbox/repo',
        factorySessionState,
        onEvent,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(receivedState).toEqual({ state: { projectPath: '/sandbox/repo', ...factorySessionState } });
  });

  it('given the event callback changes after connection, then the active stream is not resubscribed', async () => {
    const onStream = vi.fn();
    const onEvent = vi.fn();

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.get(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/modes`, () => HttpResponse.json({ modes: [] })),
      http.get(sessionUrl, () =>
        HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.get(`${sessionUrl}/stream`, () => {
        onStream();
        return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { rerender, result } = renderHookWithProviders(() =>
      useAgentControllerConnection({
        ...hookArgs,
        onEvent: event => onEvent(event),
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender();
    rerender();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onStream).toHaveBeenCalledTimes(1);
  });

  it('given an active stream, when a run event updates connection state, then the stream stays connected', async () => {
    const encoder = new TextEncoder();
    const onStream = vi.fn();
    const onEvent = vi.fn();
    let emit: (event: AgentControllerEvent) => void = () => {};

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.get(sessionUrl, () =>
        HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          running: false,
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.get(`${sessionUrl}/stream`, () => {
        onStream();
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              emit = event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            },
            cancel() {},
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
    );

    const { result } = renderHookWithProviders(() => useAgentControllerConnection({ ...hookArgs, onEvent }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    emit({ type: 'agent_start' });

    await waitFor(() => expect(result.current.state?.running).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(onStream).toHaveBeenCalledTimes(1);
  });

  it('given an active stream, when mode and model events arrive, then session state is reconciled immediately', async () => {
    const encoder = new TextEncoder();
    const onEvent = vi.fn();
    let emit: (event: AgentControllerEvent) => void = () => {};

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'state-thread' }),
      ),
      http.get(sessionUrl, () =>
        HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.get(
        `${sessionUrl}/stream`,
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                emit = event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              },
              cancel() {},
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );

    const { result } = renderHookWithProviders(() => useAgentControllerConnection({ ...hookArgs, onEvent }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });
    emit({ type: 'model_changed', modelId: 'anthropic/claude-opus-4-8' });

    await waitFor(() => {
      expect(result.current.state?.modeId).toBe('plan');
      expect(result.current.state?.modelId).toBe('anthropic/claude-opus-4-8');
    });
  });

  it('given reconnect polling is disconnected, then it backs off and stops at the retry cap', () => {
    expect(reconnectRefetchInterval(true, 0)).toBe(false);
    expect(reconnectRefetchInterval(false, 0)).toBe(1000);
    expect(reconnectRefetchInterval(false, 1)).toBe(2000);
    expect(reconnectRefetchInterval(false, 5)).toBe(30_000);
    expect(reconnectRefetchInterval(false, 9)).toBe(30_000);
    expect(reconnectRefetchInterval(false, 10)).toBe(false);
  });

  it('given synced state exists before the stream connects, then status remains connecting', () => {
    expect(
      deriveConnectionStatus({
        initIsError: false,
        syncIsError: false,
        hasSyncData: true,
        sseConnected: false,
        hasEverConnected: false,
        syncFailureCount: 0,
      }),
    ).toBe('connecting');
  });

  it('given synced state exists after the stream has connected before, then status is reconnecting', () => {
    expect(
      deriveConnectionStatus({
        initIsError: false,
        syncIsError: false,
        hasSyncData: true,
        sseConnected: false,
        hasEverConnected: true,
        syncFailureCount: 0,
      }),
    ).toBe('reconnecting');
  });

  it('given synced state exists but reconnect polling reaches the retry cap, then status is error', () => {
    expect(
      deriveConnectionStatus({
        initIsError: false,
        syncIsError: true,
        hasSyncData: true,
        sseConnected: false,
        hasEverConnected: false,
        syncFailureCount: 10,
      }),
    ).toBe('error');
  });

  it('given the stream is slow to establish, when the reconnect poll refetches state, then the in-flight stream attempt is not cancelled', async () => {
    const onReadState = vi.fn();
    const onStream = vi.fn();
    const onEvent = vi.fn();
    const observedStatuses: string[] = [];

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
      http.get(`${sessionUrl}/stream`, async () => {
        onStream();
        // Slower than the 1s reconnect poll — the poll fires while this
        // stream is still connecting.
        await new Promise(resolve => setTimeout(resolve, 1600));
        return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { result } = renderHookWithProviders(() => {
      const connection = useAgentControllerConnection({ ...hookArgs, onEvent });

      useEffect(() => {
        observedStatuses.push(connection.status);
      }, [connection.status]);

      return connection;
    });

    // The poll refetches state at least once while the stream is connecting…
    await waitFor(() => expect(onReadState.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 2500 });
    // …and the slow stream still connects instead of being torn down.
    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 3000 });

    expect(onStream).toHaveBeenCalledTimes(1);
    expect(observedStatuses).not.toContain('reconnecting');
  });

  it('given an active stream, when the session state is refetched, then the stream is not torn down', async () => {
    const onStream = vi.fn();
    const onEvent = vi.fn();
    const observedStatuses: string[] = [];

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.get(sessionUrl, () =>
        HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: 'state-thread',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
      http.get(`${sessionUrl}/stream`, () => {
        onStream();
        return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { client, result } = renderHookWithProviders(() => {
      const connection = useAgentControllerConnection({ ...hookArgs, onEvent });

      useEffect(() => {
        observedStatuses.push(connection.status);
      }, [connection.status]);

      return connection;
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    // A refetch bumps dataUpdatedAt (the subscription epoch) — e.g. a mutation
    // invalidating controller state. The established stream must survive it.
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerConnectionState(controllerId, resourceId, undefined),
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onStream).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(observedStatuses).not.toContain('reconnecting');
  });

  it('given the stream drops, when the state re-sync succeeds, then the hook resubscribes and returns to ready', async () => {
    const onReadState = vi.fn();
    const onStream = vi.fn();
    const onEvent = vi.fn();

    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId: 'created-thread' }),
      ),
      http.get(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/modes`, () => HttpResponse.json({ modes: [] })),
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({
          controllerId,
          resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: `state-thread-${onReadState.mock.calls.length}`,
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
      http.get(`${sessionUrl}/stream`, () => {
        onStream();
        if (onStream.mock.calls.length === 1) {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                setTimeout(() => controller.error(new Error('stream dropped')), 0);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }
        return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useAgentControllerConnection({ ...hookArgs, onEvent }));

    await waitFor(() => expect(onStream).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onReadState).toHaveBeenCalledTimes(2), { timeout: 2500 });
    await waitFor(() => expect(onStream).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.state?.threadId).toBe('state-thread-2');
  });
});
