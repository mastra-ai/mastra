import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useStoredAgent, useStoredAgentMutations, useStoredAgents } from '../use-stored-agents';
import { makeStoredAgent, makeStoredAgentsList } from './fixtures/editor-agents';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const AGENT_ID = 'agent-1';


describe('when Studio users manage stored agent editor records', () => {
  it('lists only favorited agents through the real client-js query contract', async () => {
    const starred = makeStoredAgent({ id: AGENT_ID, name: 'Starred editor agent', isFavorited: true, favoriteCount: 3 });
    const onList = vi.fn<(url: URL) => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents`, ({ request }) => {
        const url = new URL(request.url);
        onList(url);
        expect(url.searchParams.get('favoritedOnly')).toBe('true');
        expect(url.searchParams.get('pinFavoritedFor')).toBe('admin-user');
        return HttpResponse.json(makeStoredAgentsList([starred]));
      }),
    );

    const { wrapper } = makeWrapper({ router: true });
    const { result } = renderHook(
      () => useStoredAgents({ favoritedOnly: true, pinFavoritedFor: 'admin-user' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.agents[0]?.id).toBe(AGENT_ID));

    expect(onList).toHaveBeenCalledTimes(1);
    expect(result.current.data?.agents[0]?.isFavorited).toBe(true);
    expect(result.current.data?.agents[0]?.favoriteCount).toBe(3);
  });

  it('returns null instead of poisoning the cache when a code-only stored agent lookup 404s', async () => {
    const onDetail = vi.fn<() => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/code-only-agent`, () => {
        onDetail();
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
    );

    const { wrapper } = makeWrapper({ router: true });
    const { result } = renderHook(() => useStoredAgent('code-only-agent'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onDetail).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeNull();
  });

  it('creates, updates, and deletes stored agents with cache effects Studio depends on', async () => {
    const created = makeStoredAgent({ id: AGENT_ID, name: 'Created Agent' });
    const updated = makeStoredAgent({ id: AGENT_ID, name: 'Updated Agent' });
    let createBody: Record<string, unknown> | null = null;
    let updateBody: Record<string, unknown> | null = null;
    const onDelete = vi.fn<() => void>();

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/agents`, async ({ request }) => {
        createBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(created);
      }),
      http.patch(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
        updateBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(updated);
      }),
      http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        onDelete();
        return HttpResponse.json({ success: true, message: 'deleted' });
      }),
    );

    const { queryClient, wrapper } = makeWrapper({ router: true });
    queryClient.setQueryData(['stored-agents'], makeStoredAgentsList([created]));
    queryClient.setQueryData(['agents'], { agents: [created], total: 1 });
    queryClient.setQueryData(['agent', AGENT_ID], created);

    const { result } = renderHook(() => useStoredAgentMutations(AGENT_ID), { wrapper });

    await act(async () => {
      await result.current.createStoredAgent.mutateAsync({
        id: AGENT_ID,
        name: 'Created Agent',
        instructions: 'Created instructions',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
      });
    });

    expect(createBody).toEqual({
      id: AGENT_ID,
      name: 'Created Agent',
      instructions: 'Created instructions',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    });
    expect(queryClient.getQueriesData({ queryKey: ['stored-agent', AGENT_ID] }).map(([, value]) => value)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: AGENT_ID, name: 'Created Agent' })]),
    );

    await act(async () => {
      await result.current.updateStoredAgent.mutateAsync({
        name: 'Updated Agent',
        tools: {
          getWeather: { description: 'Use live weather' },
        },
        model: { provider: 'anthropic', name: 'claude-3-5-sonnet' },
      });
    });

    expect(updateBody).toEqual({
      name: 'Updated Agent',
      tools: {
        getWeather: { description: 'Use live weather' },
      },
      model: { provider: 'anthropic', name: 'claude-3-5-sonnet' },
    });
    expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['agent', AGENT_ID])?.isInvalidated).toBe(true);

    await act(async () => {
      await result.current.deleteStoredAgent.mutateAsync();
    });
    await waitForMutationsIdle(queryClient);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['stored-agent', AGENT_ID])).toBeUndefined();
    expect(queryClient.getQueryData(['agent', AGENT_ID])).toBeUndefined();
  });

  it('persists Agent CMS section selections in one editor-backed agent payload', async () => {
    const saved = makeStoredAgent({
      id: AGENT_ID,
      name: 'Configured Agent',
      description: 'Routes requests with editor-managed dependencies.',
      instructions: [
        { type: 'text', content: 'Use the selected prompt block and escalation path.' },
        { type: 'prompt_block_ref', id: 'refund-policy-block' },
      ],
      tools: { getWeather: { description: 'Use live weather with safety limits' } },
      mcpClients: { weatherMcp: { tools: { weather: { description: 'Fetch live weather' } } } },
      workflows: { supportWorkflow: { description: 'Escalate complex support cases' } },
      agents: { escalationAgent: { description: 'Hand off urgent requests' } },
      scorers: { helpfulness: { description: 'Judge helpfulness', sampling: { type: 'ratio', rate: 0.25 } } },
      skills: { refundPolicy: { description: 'Use refund policy', instructions: 'Follow policy exactly.', strategy: 'latest' } },
      memory: { vector: false, options: { lastMessages: 10 } },
      workspace: { type: 'id', workspaceId: 'support-workspace' },
      browser: { type: 'inline', config: { provider: 'chromium', headless: true } },
      requestContextSchema: {
        type: 'object',
        properties: { tenantId: { type: 'string' } },
        required: ['tenantId'],
      },
    });
    let updateBody: Record<string, unknown> | null = null;

    server.use(
      http.patch(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
        updateBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(saved);
      }),
    );

    const { queryClient, wrapper } = makeWrapper({ router: true });
    queryClient.setQueryData(['stored-agents'], makeStoredAgentsList([makeStoredAgent({ id: AGENT_ID })]));
    queryClient.setQueryData(['stored-agent', AGENT_ID], makeStoredAgent({ id: AGENT_ID }));

    const { result } = renderHook(() => useStoredAgentMutations(AGENT_ID), { wrapper });

    await act(async () => {
      await result.current.updateStoredAgent.mutateAsync({
        name: 'Configured Agent',
        description: 'Routes requests with editor-managed dependencies.',
        instructions: [
          { type: 'text', content: 'Use the selected prompt block and escalation path.' },
          { type: 'prompt_block_ref', id: 'refund-policy-block' },
        ],
        tools: { getWeather: { description: 'Use live weather with safety limits' } },
        mcpClients: { weatherMcp: { tools: { weather: { description: 'Fetch live weather' } } } },
        workflows: { supportWorkflow: { description: 'Escalate complex support cases' } },
        agents: { escalationAgent: { description: 'Hand off urgent requests' } },
        scorers: { helpfulness: { description: 'Judge helpfulness', sampling: { type: 'ratio', rate: 0.25 } } },
        skills: { refundPolicy: { description: 'Use refund policy', instructions: 'Follow policy exactly.', strategy: 'latest' } },
        memory: { vector: false, options: { lastMessages: 10 } },
        workspace: { type: 'id', workspaceId: 'support-workspace' },
        browser: { type: 'inline', config: { provider: 'chromium', headless: true } },
        requestContextSchema: {
          type: 'object',
          properties: { tenantId: { type: 'string' } },
          required: ['tenantId'],
        },
      });
    });
    await waitForMutationsIdle(queryClient);

    expect(updateBody).toEqual({
      name: 'Configured Agent',
      description: 'Routes requests with editor-managed dependencies.',
      instructions: [
        { type: 'text', content: 'Use the selected prompt block and escalation path.' },
        { type: 'prompt_block_ref', id: 'refund-policy-block' },
      ],
      tools: { getWeather: { description: 'Use live weather with safety limits' } },
      mcpClients: { weatherMcp: { tools: { weather: { description: 'Fetch live weather' } } } },
      workflows: { supportWorkflow: { description: 'Escalate complex support cases' } },
      agents: { escalationAgent: { description: 'Hand off urgent requests' } },
      scorers: { helpfulness: { description: 'Judge helpfulness', sampling: { type: 'ratio', rate: 0.25 } } },
      skills: { refundPolicy: { description: 'Use refund policy', instructions: 'Follow policy exactly.', strategy: 'latest' } },
      memory: { vector: false, options: { lastMessages: 10 } },
      workspace: { type: 'id', workspaceId: 'support-workspace' },
      browser: { type: 'inline', config: { provider: 'chromium', headless: true } },
      requestContextSchema: {
        type: 'object',
        properties: { tenantId: { type: 'string' } },
        required: ['tenantId'],
      },
    });
    expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['stored-agent', AGENT_ID])?.isInvalidated).toBe(true);
  });
});
