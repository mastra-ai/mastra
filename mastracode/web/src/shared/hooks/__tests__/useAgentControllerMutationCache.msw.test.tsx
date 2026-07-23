import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useSetAgentControllerGoalMutation } from '../useAgentControllerGoalMutations';
import { useSendAgentControllerMessageMutation } from '../useAgentControllerRunMutations';
import { useAgentControllerSettings } from '../useAgentControllerSettings';
import { useSetAgentControllerStateMutation } from '../useAgentControllerStateMutations';
import { useCreateAgentControllerThreadMutation } from '../useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const resourceId = 'resource-test';
const scope = '/sandbox/mastra';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = {
  agentControllerId: controllerId,
  resourceId,
  scope,
  baseUrl: TEST_BASE_URL,
  enabled: true,
};

function initialSettings(): AgentControllerSessionSettings {
  return {
    yolo: false,
    thinkingLevel: 'off',
    notifications: 'off',
    smartEditing: false,
  };
}

describe('agent-controller mutation hooks cache behavior', () => {
  it('does not refresh settings after sending a message', async () => {
    let settings = initialSettings();
    const onReadState = vi.fn();
    const onSendMessage = vi.fn();

    server.use(
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({ threadId: 'thread-one', settings });
      }),
      http.post(`${sessionUrl}/messages`, async ({ request }) => {
        onSendMessage(await request.json());
        settings = { ...settings, notifications: 'bell' };
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      settingsQuery: useAgentControllerSettings(hookArgs),
      sendMessage: useSendAgentControllerMessageMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.settingsQuery.data?.notifications).toBe('off'));
    await act(async () => result.current.sendMessage.mutateAsync('hello'));
    await waitForMutationsIdle(client);

    expect(result.current.settingsQuery.data?.notifications).toBe('off');
    expect(onReadState).toHaveBeenCalledTimes(1);
    expect(onSendMessage).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('does not refresh settings after goal changes', async () => {
    let settings = initialSettings();
    const onReadState = vi.fn();
    const onSetGoal = vi.fn();

    server.use(
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({ threadId: 'thread-one', settings });
      }),
      http.post(`${sessionUrl}/goal`, async ({ request }) => {
        onSetGoal(await request.json());
        settings = { ...settings, smartEditing: true };
        return HttpResponse.json({ goal: { objective: 'ship refactor', status: 'active' } });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      settingsQuery: useAgentControllerSettings(hookArgs),
      setGoal: useSetAgentControllerGoalMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.settingsQuery.data?.smartEditing).toBe(false));
    await act(async () => result.current.setGoal.mutateAsync('ship refactor'));
    await waitForMutationsIdle(client);

    expect(result.current.settingsQuery.data?.smartEditing).toBe(false);
    expect(onReadState).toHaveBeenCalledTimes(1);
    expect(onSetGoal).toHaveBeenCalledWith({ objective: 'ship refactor' });
  });

  it('refreshes only the exact project thread list after creating a thread', async () => {
    let settings = initialSettings();
    let threads = [{ id: 'thread-one', title: 'Thread one', updatedAt: '2026-07-07T00:00:00.000Z' }];
    const onReadState = vi.fn();
    const onReadThreads = vi.fn();
    const onCreateThread = vi.fn();

    server.use(
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({ threadId: threads[0]?.id, settings });
      }),
      http.get(`${sessionUrl}/threads`, () => {
        onReadThreads();
        return HttpResponse.json({ threads });
      }),
      http.post(`${sessionUrl}/threads`, async ({ request }) => {
        onCreateThread(await request.json());
        settings = { ...settings, yolo: true };
        threads = [{ id: 'thread-two', title: 'New work', updatedAt: '2026-07-07T01:00:00.000Z' }, ...threads];
        return HttpResponse.json(threads[0]);
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      settingsQuery: useAgentControllerSettings(hookArgs),
      threadsQuery: useAgentControllerThreads(hookArgs),
      createThread: useCreateAgentControllerThreadMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.threadsQuery.data?.map(thread => thread.id)).toEqual(['thread-one']));
    await waitFor(() => expect(result.current.settingsQuery.data?.yolo).toBe(false));
    await act(async () => result.current.createThread.mutateAsync('New work'));
    await waitForMutationsIdle(client);

    await waitFor(() =>
      expect(result.current.threadsQuery.data?.map(thread => thread.id)).toEqual(['thread-two', 'thread-one']),
    );
    expect(result.current.settingsQuery.data?.yolo).toBe(false);
    expect(onReadThreads).toHaveBeenCalledTimes(2);
    expect(onReadState).toHaveBeenCalledTimes(1);
    expect(onCreateThread).toHaveBeenCalledWith({ title: 'New work' });
  });

  it('does not refresh settings for a state update outside the settings slice', async () => {
    const settings = initialSettings();
    const onReadState = vi.fn();

    server.use(
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({ threadId: 'thread-one', settings });
      }),
      http.put(`${sessionUrl}/state`, () => HttpResponse.json({ ok: true })),
    );

    const { result, client } = renderHookWithProviders(() => ({
      settingsQuery: useAgentControllerSettings(hookArgs),
      setState: useSetAgentControllerStateMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.settingsQuery.data).toEqual(settings));
    await act(async () => result.current.setState.mutateAsync({ projectPath: '/sandbox/next' }));
    await waitForMutationsIdle(client);

    expect(onReadState).toHaveBeenCalledTimes(1);
  });

  it('refreshes settings when a state update includes the settings slice', async () => {
    let settings = initialSettings();
    const onReadState = vi.fn();

    server.use(
      http.get(sessionUrl, () => {
        onReadState();
        return HttpResponse.json({ threadId: 'thread-one', settings });
      }),
      http.put(`${sessionUrl}/state`, async ({ request }) => {
        const body = (await request.json()) as { state?: { settings?: AgentControllerSessionSettings } };
        settings = body.state?.settings ?? settings;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      settingsQuery: useAgentControllerSettings(hookArgs),
      setState: useSetAgentControllerStateMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.settingsQuery.data?.yolo).toBe(false));
    await act(async () => result.current.setState.mutateAsync({ settings: { ...settings, yolo: true } }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.settingsQuery.data?.yolo).toBe(true));
    expect(onReadState).toHaveBeenCalledTimes(2);
  });
});
