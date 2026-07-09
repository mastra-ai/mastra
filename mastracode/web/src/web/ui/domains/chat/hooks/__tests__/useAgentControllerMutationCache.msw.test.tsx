import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../e2e/web-ui/render';
import { useSetAgentControllerGoalMutation } from '../useAgentControllerGoalMutations';
import { useSendAgentControllerMessageMutation } from '../useAgentControllerRunMutations';
import { useAgentControllerSettings } from '../useAgentControllerSettings';
import { useCreateAgentControllerThreadMutation } from '../useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const resourceId = 'resource-test';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = { agentControllerId: controllerId, resourceId, baseUrl: TEST_BASE_URL, enabled: true };

describe('agent-controller mutation hooks cache behavior', () => {
  it('refreshes session-scoped settings after sending a message', async () => {
    let settings: AgentControllerSessionSettings = {
      yolo: false,
      thinkingLevel: 'off',
      notifications: 'off',
      smartEditing: false,
    };
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

    const { result, client } = renderHookWithProviders(() => {
      const settingsQuery = useAgentControllerSettings(hookArgs);
      const sendMessage = useSendAgentControllerMessageMutation(hookArgs);
      return { settingsQuery, sendMessage };
    });

    await waitFor(() => expect(result.current.settingsQuery.data?.notifications).toBe('off'));

    await act(async () => {
      await result.current.sendMessage.mutateAsync('hello');
    });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.settingsQuery.data?.notifications).toBe('bell'));
    expect(onReadState).toHaveBeenCalledTimes(2);
    expect(onSendMessage).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('refreshes session-scoped settings after goal changes', async () => {
    let settings: AgentControllerSessionSettings = {
      yolo: false,
      thinkingLevel: 'off',
      notifications: 'off',
      smartEditing: false,
    };
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

    const { result, client } = renderHookWithProviders(() => {
      const settingsQuery = useAgentControllerSettings(hookArgs);
      const setGoal = useSetAgentControllerGoalMutation(hookArgs);
      return { settingsQuery, setGoal };
    });

    await waitFor(() => expect(result.current.settingsQuery.data?.smartEditing).toBe(false));

    await act(async () => {
      await result.current.setGoal.mutateAsync('ship refactor');
    });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.settingsQuery.data?.smartEditing).toBe(true));
    expect(onReadState).toHaveBeenCalledTimes(2);
    expect(onSetGoal).toHaveBeenCalledWith({ objective: 'ship refactor' });
  });

  it('refreshes both the project thread list and session-scoped state after creating a thread', async () => {
    let settings: AgentControllerSessionSettings = {
      yolo: false,
      thinkingLevel: 'off',
      notifications: 'off',
      smartEditing: false,
    };
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

    const { result, client } = renderHookWithProviders(() => {
      const settingsQuery = useAgentControllerSettings(hookArgs);
      const threadsQuery = useAgentControllerThreads({ ...hookArgs, projectPath: '/sandbox/mastra' });
      const createThread = useCreateAgentControllerThreadMutation({ ...hookArgs, projectPath: '/sandbox/mastra' });
      return { settingsQuery, threadsQuery, createThread };
    });

    await waitFor(() => expect(result.current.threadsQuery.data?.map(thread => thread.id)).toEqual(['thread-one']));
    await waitFor(() => expect(result.current.settingsQuery.data?.yolo).toBe(false));

    await act(async () => {
      await result.current.createThread.mutateAsync('New work');
    });
    await waitForMutationsIdle(client);

    await waitFor(() =>
      expect(result.current.threadsQuery.data?.map(thread => thread.id)).toEqual(['thread-two', 'thread-one']),
    );
    await waitFor(() => expect(result.current.settingsQuery.data?.yolo).toBe(true));
    expect(onReadThreads).toHaveBeenCalledTimes(2);
    expect(onReadState).toHaveBeenCalledTimes(2);
    expect(onCreateThread).toHaveBeenCalledWith({ title: 'New work' });
  });
});
