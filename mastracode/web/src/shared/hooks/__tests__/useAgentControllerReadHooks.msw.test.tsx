import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { useAgentControllerModels } from '../useAgentControllerModels';
import { useAgentControllerThreadMessages } from '../useAgentControllerThreadMessages';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE, useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const resourceId = 'resource-test';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = { agentControllerId: controllerId, resourceId, baseUrl: TEST_BASE_URL, enabled: true };

describe('agent-controller read hooks', () => {
  it('filters models to providers with API keys before caching them', async () => {
    const onReadModels = vi.fn();

    server.use(
      http.get(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/models`, () => {
        onReadModels();
        return HttpResponse.json({
          models: [
            { id: 'openai/gpt-4.1', label: 'GPT 4.1', provider: 'openai', hasApiKey: true },
            {
              id: 'anthropic/claude-sonnet-4-20250514',
              label: 'Claude Sonnet 4',
              provider: 'anthropic',
              hasApiKey: false,
            },
          ],
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useAgentControllerModels(hookArgs));

    await waitFor(() => expect(result.current.data?.map(model => model.id)).toEqual(['openai/gpt-4.1']));
    expect(onReadModels).toHaveBeenCalledTimes(1);
  });

  it('scopes the thread list request to the active factory path and sidebar page size', async () => {
    const onReadThreads = vi.fn();

    server.use(
      http.get(`${sessionUrl}/threads`, ({ request }) => {
        const url = new URL(request.url);
        onReadThreads({ limit: url.searchParams.get('limit'), tags: url.searchParams.get('tags') });
        return HttpResponse.json({
          threads: [{ id: 'thread-one', title: 'Thread one', updatedAt: '2026-07-07T00:00:00.000Z' }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerThreads({ ...hookArgs, projectPath: '/sandbox/mastra' }),
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('thread-one'));
    expect(onReadThreads).toHaveBeenCalledWith({
      limit: String(AGENT_CONTROLLER_THREAD_PAGE_SIZE),
      tags: JSON.stringify({ projectPath: '/sandbox/mastra' }),
    });
  });

  it('keeps persisted thread messages from refetching on window focus', async () => {
    const onReadMessages = vi.fn();

    server.use(
      http.get(`${sessionUrl}/threads/thread-one/messages`, () => {
        onReadMessages();
        return HttpResponse.json({
          messages: [{ id: 'message-one', role: 'assistant', content: 'Persisted reply' }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerThreadMessages({ ...hookArgs, threadId: 'thread-one' }),
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('message-one'));

    window.dispatchEvent(new Event('focus'));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(onReadMessages).toHaveBeenCalledTimes(1);
  });
});
