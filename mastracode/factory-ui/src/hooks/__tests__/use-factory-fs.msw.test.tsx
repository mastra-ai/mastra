import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { FactoryFsFile, FactoryFsListing } from '../../api/types';
import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../e2e/ui/render';
import { useFactoryFsFile, useFactoryFsListing } from '../use-factory-fs';

const LIST_URL = `${TEST_BASE_URL}/web/factory/fs/list`;
const FILE_URL = `${TEST_BASE_URL}/web/factory/fs/file`;

const listing: FactoryFsListing = {
  available: true,
  projectDir: 'projects/Alpha Project',
  entries: [
    { name: 'shared', path: 'shared', type: 'directory', size: 0, updatedAt: '' },
    { name: 'note.md', path: 'shared/note.md', type: 'file', size: 8, updatedAt: '2026-08-07T00:00:00.000Z' },
  ],
};

describe('useFactoryFsListing', () => {
  it('passes the project id and returns the org listing', async () => {
    let seenProjectId: string | null = null;
    server.use(
      http.get(LIST_URL, ({ request }) => {
        seenProjectId = new global.URL(request.url).searchParams.get('projectId');
        return HttpResponse.json(listing);
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryFsListing('project-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenProjectId).toBe('project-1');
    expect(result.current.data?.projectDir).toBe('projects/Alpha Project');
    expect(result.current.data?.entries).toHaveLength(2);
  });

  it('lists without a projectId when none is available', async () => {
    let seenProjectId: string | null = 'unset';
    server.use(
      http.get(LIST_URL, ({ request }) => {
        seenProjectId = new global.URL(request.url).searchParams.get('projectId');
        return HttpResponse.json({ available: false, entries: [] } satisfies FactoryFsListing);
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryFsListing(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenProjectId).toBe(null);
    expect(result.current.data?.available).toBe(false);
  });

  it('surfaces list errors', async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    const { result } = renderHookWithProviders(() => useFactoryFsListing('project-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useFactoryFsFile', () => {
  it('does not fetch until a path is selected', () => {
    let called = false;
    server.use(
      http.get(FILE_URL, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryFsFile(undefined));

    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });

  it('fetches the selected file', async () => {
    let seenPath: string | null = null;
    server.use(
      http.get(FILE_URL, ({ request }) => {
        seenPath = new global.URL(request.url).searchParams.get('path');
        return HttpResponse.json({
          path: 'shared/note.md',
          name: 'note.md',
          size: 8,
          updatedAt: '2026-08-07T00:00:00.000Z',
          contentType: 'text',
          content: 'org note',
        } satisfies FactoryFsFile);
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryFsFile('shared/note.md'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenPath).toBe('shared/note.md');
    expect(result.current.data?.content).toBe('org note');
  });
});
