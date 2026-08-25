import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  useBuilderRegistries,
  useBuilderRegistryPreview,
  useInstallBuilderRegistrySkill,
  usePopularBuilderRegistrySkills,
  useSearchBuilderRegistry,
} from '../use-builder-registries';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const REGISTRIES_URL = `${BASE_URL}/api/editor/builder/registries`;

/**
 * `retry` defaults to off so unrelated specs stay fast. The no-retry
 * assertions pass `retry: true` instead, so what they observe is each hook's
 * own `retry: false` rather than the client default masking it.
 */
const makeHarness = ({ retry = false }: { retry?: boolean } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

describe('useBuilderRegistries', () => {
  describe('when the server lists registries', () => {
    it('exposes them with their enabled state', async () => {
      server.use(
        http.get(REGISTRIES_URL, () =>
          HttpResponse.json({ registries: [{ id: 'skills-sh', name: 'skills.sh', enabled: true }] }),
        ),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistries(), { wrapper });

      await waitFor(() => expect(result.current.data?.registries?.[0]?.id).toBe('skills-sh'));
    });
  });

  describe('when the registry surface is gated off', () => {
    it('surfaces the 404 without retrying', async () => {
      let calls = 0;
      server.use(
        http.get(REGISTRIES_URL, () => {
          calls += 1;
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistries(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await new Promise(resolve => setTimeout(resolve, 1200));
      expect(calls).toBe(1);
    }, 10000);
  });

  describe('when the caller disables the query', () => {
    it('stays idle', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(REGISTRIES_URL, () => {
          onFetch();
          return HttpResponse.json({ registries: [] });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistries({ enabled: false }), { wrapper });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useSearchBuilderRegistry', () => {
  describe('when a registry is selected', () => {
    it('sends the query and asks for ten results', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/search`, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json({ results: [{ name: 'weather' }] });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useSearchBuilderRegistry('skills-sh'), { wrapper });

      const response = await result.current.mutateAsync('weather');

      expect(response.results?.[0]?.name).toBe('weather');
      expect(receivedUrl?.searchParams.get('q')).toBe('weather');
      expect(receivedUrl?.searchParams.get('limit')).toBe('10');
    });
  });

  describe('when no registry is selected', () => {
    it('refuses rather than calling the server', async () => {
      const onSearch = vi.fn();
      server.use(
        http.get(`${REGISTRIES_URL}/:registryId/search`, () => {
          onSearch();
          return HttpResponse.json({ results: [] });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useSearchBuilderRegistry(undefined), { wrapper });

      await expect(result.current.mutateAsync('weather')).rejects.toThrow(/Registry ID is required/);
      expect(onSearch).not.toHaveBeenCalled();
    });
  });
});

describe('usePopularBuilderRegistrySkills', () => {
  describe('when a registry is selected', () => {
    it('asks for the first ten popular skills', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/popular`, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json({ results: [{ name: 'weather' }] });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePopularBuilderRegistrySkills('skills-sh'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('limit')).toBe('10');
      expect(receivedUrl?.searchParams.get('offset')).toBe('0');
    });

    it('serves a re-open from cache rather than refetching', async () => {
      let calls = 0;
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/popular`, () => {
          calls += 1;
          return HttpResponse.json({ results: [] });
        }),
      );
      const { wrapper } = makeHarness();

      const first = renderHook(() => usePopularBuilderRegistrySkills('skills-sh'), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

      // Long enough that a stale window measured in milliseconds would lapse.
      await new Promise(resolve => setTimeout(resolve, 250));

      const second = renderHook(() => usePopularBuilderRegistrySkills('skills-sh'), { wrapper });
      await settle();

      expect(second.result.current.isSuccess).toBe(true);
      expect(calls).toBe(1);
    });

    it('keeps each registry in its own cache entry', async () => {
      server.use(
        http.get(`${REGISTRIES_URL}/:registryId/popular`, ({ params }) =>
          HttpResponse.json({ results: [{ name: `from-${params.registryId}` }] }),
        ),
      );
      const { wrapper } = makeHarness();

      const one = renderHook(() => usePopularBuilderRegistrySkills('registry-a'), { wrapper });
      await waitFor(() => expect(one.result.current.data?.results?.[0]?.name).toBe('from-registry-a'));

      const two = renderHook(() => usePopularBuilderRegistrySkills('registry-b'), { wrapper });
      await waitFor(() => expect(two.result.current.data?.results?.[0]?.name).toBe('from-registry-b'));

      expect(one.result.current.data?.results?.[0]?.name).toBe('from-registry-a');
    });
  });

  describe('when no registry is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${REGISTRIES_URL}/:registryId/popular`, () => {
          onFetch();
          return HttpResponse.json({ results: [] });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePopularBuilderRegistrySkills(undefined), { wrapper });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useBuilderRegistryPreview', () => {
  const previewArgs = ['skills-sh', 'acme', 'skills', 'weather/SKILL.md'] as const;

  describe('when every coordinate is known', () => {
    it('unwraps the rendered content', async () => {
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/preview`, () => HttpResponse.json({ content: '# Weather skill' })),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistryPreview(...previewArgs), { wrapper });

      await waitFor(() => expect(result.current.data).toBe('# Weather skill'));
    });

    it('sends the owner, repo and path', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/preview`, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json({ content: '# Weather skill' });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistryPreview(...previewArgs), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('owner')).toBe('acme');
      expect(receivedUrl?.searchParams.get('repo')).toBe('skills');
      expect(receivedUrl?.searchParams.get('path')).toBe('weather/SKILL.md');
    });

    it('keeps each skill preview in its own cache entry', async () => {
      server.use(
        http.get(`${REGISTRIES_URL}/skills-sh/preview`, ({ request }) =>
          HttpResponse.json({ content: `content for ${new URL(request.url).searchParams.get('path')}` }),
        ),
      );
      const { wrapper } = makeHarness();

      const one = renderHook(() => useBuilderRegistryPreview('skills-sh', 'acme', 'skills', 'a/SKILL.md'), {
        wrapper,
      });
      await waitFor(() => expect(one.result.current.data).toBe('content for a/SKILL.md'));

      const two = renderHook(() => useBuilderRegistryPreview('skills-sh', 'acme', 'skills', 'b/SKILL.md'), {
        wrapper,
      });
      await waitFor(() => expect(two.result.current.data).toBe('content for b/SKILL.md'));

      expect(one.result.current.data).toBe('content for a/SKILL.md');
    });
  });

  describe.each([
    ['the registry', undefined, 'acme', 'skills', 'weather/SKILL.md'],
    ['the owner', 'skills-sh', undefined, 'skills', 'weather/SKILL.md'],
    ['the repo', 'skills-sh', 'acme', undefined, 'weather/SKILL.md'],
    ['the path', 'skills-sh', 'acme', 'skills', undefined],
  ])('when %s is unknown', (_label, registryId, owner, repo, skillPath) => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${REGISTRIES_URL}/:registryId/preview`, () => {
          onFetch();
          return HttpResponse.json({ content: '' });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistryPreview(registryId, owner, repo, skillPath), { wrapper });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when the caller disables the query', () => {
    it('stays idle even with every coordinate known', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${REGISTRIES_URL}/:registryId/preview`, () => {
          onFetch();
          return HttpResponse.json({ content: '' });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistryPreview(...previewArgs, { enabled: false }), { wrapper });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('runs when the caller passes enabled explicitly true', async () => {
      server.use(http.get(`${REGISTRIES_URL}/skills-sh/preview`, () => HttpResponse.json({ content: 'ok' })));

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useBuilderRegistryPreview(...previewArgs, { enabled: true }), { wrapper });

      await waitFor(() => expect(result.current.data).toBe('ok'));
    });
  });
});

describe('useInstallBuilderRegistrySkill', () => {
  describe('when the install succeeds', () => {
    it('posts the body and refreshes the stored-skills list', async () => {
      let body: unknown;
      server.use(
        http.post(`${REGISTRIES_URL}/skills-sh/install`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ skillId: 'weather' });
        }),
      );

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-skills'], { skills: [] });
      queryClient.setQueryData(['stored-agents'], { agents: [] });

      const { result } = renderHook(() => useInstallBuilderRegistrySkill('skills-sh'), { wrapper });
      await result.current.mutateAsync({ owner: 'acme', repo: 'skills', path: 'weather' } as never);

      expect(body).toMatchObject({ owner: 'acme', repo: 'skills' });
      await waitFor(() => expect(queryClient.getQueryState(['stored-skills'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(false);
    });
  });

  describe('when the skill already exists', () => {
    it('rejects and leaves the stored-skills list alone', async () => {
      server.use(
        http.post(`${REGISTRIES_URL}/skills-sh/install`, () =>
          HttpResponse.json({ error: 'already exists' }, { status: 409 }),
        ),
      );

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-skills'], { skills: [] });

      const { result } = renderHook(() => useInstallBuilderRegistrySkill('skills-sh'), { wrapper });

      await expect(result.current.mutateAsync({ owner: 'acme', repo: 'skills', path: 'w' } as never)).rejects.toThrow();
      expect(queryClient.getQueryState(['stored-skills'])?.isInvalidated).toBe(false);
    });
  });

  describe('when no registry is selected', () => {
    it('refuses rather than calling the server', async () => {
      const onInstall = vi.fn();
      server.use(
        http.post(`${REGISTRIES_URL}/:registryId/install`, () => {
          onInstall();
          return HttpResponse.json({ skillId: 'weather' });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useInstallBuilderRegistrySkill(undefined), { wrapper });

      await expect(result.current.mutateAsync({ owner: 'a', repo: 'b', path: 'c' } as never)).rejects.toThrow(
        /Registry ID is required/,
      );
      expect(onInstall).not.toHaveBeenCalled();
    });
  });
});

describe('the cache entries the registry hooks write', () => {
  it('files the registry list under a key of its own', async () => {
    server.use(http.get(REGISTRIES_URL, () => HttpResponse.json({ registries: [] })));
    const { wrapper, queryClient } = makeHarness();

    const { result } = renderHook(() => useBuilderRegistries(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(['builder-registries'])).toEqual({ registries: [] });
  });

  it("files a popular feed under its registry, apart from that registry's previews", async () => {
    server.use(http.get(`${REGISTRIES_URL}/skills-sh/popular`, () => HttpResponse.json({ skills: [] })));
    const { wrapper, queryClient } = makeHarness();

    const { result } = renderHook(() => usePopularBuilderRegistrySkills('skills-sh'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(['builder-registry', 'skills-sh', 'popular'])).toBeDefined();
    expect(queryClient.getQueryData(['builder-registry', 'other', 'popular'])).toBeUndefined();
  });

  it('files a rendered preview under the skill it renders', async () => {
    server.use(http.get(`${REGISTRIES_URL}/skills-sh/preview`, () => HttpResponse.json({ content: '# Weather' })));
    const { wrapper, queryClient } = makeHarness();

    const { result } = renderHook(() => useBuilderRegistryPreview('skills-sh', 'acme', 'skills', 'weather/SKILL.md'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryData(['builder-registry', 'skills-sh', 'preview', 'acme', 'skills', 'weather/SKILL.md']),
    ).toBe('# Weather');
  });
});

/**
 * `MastraClient.request` has its own retry budget, so a 5xx reaches React Query
 * only after the SDK has given up. What `retry: false` guarantees is that React
 * Query does not start that sequence over — i.e. the attempt count stops
 * growing once the error surfaces.
 */
describe('the registry reads do not retry a failure', () => {
  it('surfaces a popular-feed failure after one attempt', async () => {
    let calls = 0;
    server.use(
      http.get(`${REGISTRIES_URL}/skills-sh/popular`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { wrapper } = makeHarness({ retry: true });

    const { result } = renderHook(() => usePopularBuilderRegistrySkills('skills-sh'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const afterFirstFailure = calls;

    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(calls).toBe(afterFirstFailure);
  });

  it('surfaces a preview failure after one attempt', async () => {
    let calls = 0;
    server.use(
      http.get(`${REGISTRIES_URL}/skills-sh/preview`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { wrapper } = makeHarness({ retry: true });

    const { result } = renderHook(() => useBuilderRegistryPreview('skills-sh', 'acme', 'skills', 'a/SKILL.md'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const afterFirstFailure = calls;

    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(calls).toBe(afterFirstFailure);
  });

  it('surfaces a registry-list failure after one attempt', async () => {
    let calls = 0;
    server.use(
      http.get(REGISTRIES_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { wrapper } = makeHarness({ retry: true });

    const { result } = renderHook(() => useBuilderRegistries(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const afterFirstFailure = calls;

    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(calls).toBe(afterFirstFailure);
  });
});
