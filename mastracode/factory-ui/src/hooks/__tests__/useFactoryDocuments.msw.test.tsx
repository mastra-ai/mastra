/**
 * useFactoryDocuments / useFactoryDocument / useRefreshFactoryDocuments —
 * the Documents page's query stack against the server routes.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { FactoryDocumentsResponse } from '../../api/types';
import { RequestError } from '../../ui/domains/factory/services/request';
import { useFactoryDocument, useFactoryDocuments, useRefreshFactoryDocuments } from '../useFactoryDocuments';

const PROJECT_ID = 'fp-1';
const LIST_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/documents`;

const listFixture: FactoryDocumentsResponse = {
  docsRoot: 'docs/factory',
  manifestPath: 'docs/factory/manifest.yaml',
  catalog: [
    { kind: 'glossary', group: 'ba', label: 'Glossary', defaultPath: 'docs/factory/glossary.md', purpose: 'Terms.' },
  ],
  documents: [],
  sync: null,
};

describe('useFactoryDocuments', () => {
  it('stays idle without a project id and loads the inventory with one', async () => {
    let requests = 0;
    server.use(
      http.get(LIST_URL, () => {
        requests += 1;
        return HttpResponse.json(listFixture);
      }),
    );

    const idle = renderHookWithProviders(() => useFactoryDocuments(undefined));
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHookWithProviders(() => useFactoryDocuments(PROJECT_ID));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.catalog[0]?.kind).toBe('glossary');
    expect(requests).toBe(1);
  });
});

describe('useFactoryDocument', () => {
  it('surfaces a 404 as a RequestError without retrying', async () => {
    let requests = 0;
    server.use(
      http.get(`${LIST_URL}/roadmap`, () => {
        requests += 1;
        return HttpResponse.json({ error: 'Document not found' }, { status: 404 });
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryDocument(PROJECT_ID, 'roadmap'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(RequestError);
    expect((result.current.error as RequestError).status).toBe(404);
    expect(requests).toBe(1);
  });
});

describe('useRefreshFactoryDocuments', () => {
  it('POSTs the refresh and refetches the inventory', async () => {
    let listRequests = 0;
    let posted = false;
    server.use(
      http.get(LIST_URL, () => {
        listRequests += 1;
        return HttpResponse.json(listFixture);
      }),
      http.post(`${LIST_URL}/refresh`, () => {
        posted = true;
        return HttpResponse.json({ ok: true, outcome: 'synced', sync: null });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      list: useFactoryDocuments(PROJECT_ID),
      refresh: useRefreshFactoryDocuments(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listRequests).toBe(1);

    result.current.refresh.mutate();
    await waitForMutationsIdle(client);

    expect(posted).toBe(true);
    expect(result.current.refresh.isSuccess).toBe(true);
    expect(listRequests).toBe(2);
  });
});
