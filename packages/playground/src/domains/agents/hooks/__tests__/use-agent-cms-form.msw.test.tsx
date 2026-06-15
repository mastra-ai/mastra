// @vitest-environment jsdom
import type { ListStoredPromptBlocksResponse, StoredPromptBlockResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AgentDataSource } from '../../utils/compute-agent-initial-values';
import { useAgentCmsForm } from '../use-agent-cms-form';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-under-edit';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

/** Resolves once the `useStoredPromptBlocks` query has data in the cache. */
const waitForPromptBlocksLoaded = async (queryClient: QueryClient) => {
  await waitFor(() => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['stored-prompt-blocks'] });
    expect(queries.some(q => q.state.data !== undefined)).toBe(true);
  });
};

/** Minimal prompt block list fixture, typed from the client SDK response. */
const promptBlock = (overrides: Partial<StoredPromptBlockResponse>): StoredPromptBlockResponse => ({
  id: 'block',
  status: 'draft',
  name: 'Block',
  content: 'Block content.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const listResponse = (blocks: StoredPromptBlockResponse[]): ListStoredPromptBlocksResponse => ({
  promptBlocks: blocks,
  total: blocks.length,
  page: 0,
  perPage: 100,
  hasMore: false,
});

/**
 * Data source for an agent whose instructions are a single prompt-block ref.
 *
 * These are module-level constants on purpose: `useAgentCmsForm` keys its
 * `initialValues` memo and its form-reset effect on the `dataSource` reference,
 * so passing a freshly-built object on every render would retrigger the reset
 * effect in a loop. In the real app the data source comes from React Query and
 * is referentially stable.
 */
const dataSourceWithRef = (promptBlockId: string): AgentDataSource => ({
  name: 'Support Agent',
  model: { provider: 'test-provider', name: 'test-model' },
  instructions: [{ type: 'prompt_block_ref', id: promptBlockId }],
});

const DRAFT_REF_DATA_SOURCE = dataSourceWithRef('draft-block');
const PUBLISHED_REF_DATA_SOURCE = dataSourceWithRef('live-block');

describe('useAgentCmsForm — empty-runtime guard', () => {
  afterEach(() => {
    cleanup();
  });

  it('blocks saving a draft when every referenced prompt block is unpublished', async () => {
    let patchCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        // Draft block — no activeVersionId, so runtime would skip it.
        HttpResponse.json(listResponse([promptBlock({ id: 'draft-block', status: 'draft' })])),
      ),
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: AGENT_ID });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource: DRAFT_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    // Wait until the prompt block list has loaded so the guard can see the draft.
    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });
    await waitForPromptBlocksLoaded(queryClient);

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    // The save must be blocked — no agent update request goes out.
    expect(patchCalled).toBe(false);
  });

  it('allows saving when at least one referenced prompt block is published', async () => {
    let patchCalled = false;
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks`, () =>
        // Published block — has an active version, so runtime keeps it.
        HttpResponse.json(
          listResponse([promptBlock({ id: 'live-block', status: 'published', activeVersionId: 'v1' })]),
        ),
      ),
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: AGENT_ID });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () =>
        useAgentCmsForm({
          mode: 'edit',
          agentId: AGENT_ID,
          dataSource: PUBLISHED_REF_DATA_SOURCE,
          onSuccess: () => {},
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.form.getValues('instructionBlocks')).toHaveLength(1);
    });
    await waitForPromptBlocksLoaded(queryClient);

    await act(async () => {
      await result.current.handleSaveDraft();
    });

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
  });
});
