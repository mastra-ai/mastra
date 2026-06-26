// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useEntities, useEntity } from '../use-entity-learning';
import { useSignalPoints } from '../use-signal-points';
import { useSignalTopics } from '../use-signal-topics';
import { useTopicExamples } from '../use-topic-examples';
import {
  ENTITY_ID,
  entitiesResponse,
  pointsResponse,
  topicExamplesResponse,
  topicsResponse,
} from './fixtures/entity-learning';

const PLATFORM_URL = 'https://platform.test';
const OBSERVABILITY_URL = 'https://observability.test';
const server = setupServer();

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  delete (window as { MASTRA_CLOUD_API_ENDPOINT?: string }).MASTRA_CLOUD_API_ENDPOINT;
  delete (window as { MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string }).MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
  delete (window as { MASTRA_ORGANIZATION_ID?: string }).MASTRA_ORGANIZATION_ID;
  delete (window as { MASTRA_PLATFORM_PROJECT_ID?: string }).MASTRA_PLATFORM_PROJECT_ID;
});

afterAll(() => server.close());

function enablePlatform() {
  window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
}

function enableObservability() {
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = OBSERVABILITY_URL;
}

describe('useEntities / useEntity', () => {
  it('returns the typed entities including availableSignals', async () => {
    enablePlatform();
    server.use(http.get(`${PLATFORM_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)));

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].availableSignals).toEqual(['behavior', 'goal', 'outcome', 'sentiment']);
    expect(result.current.data?.[0].latestRunId).toBe('32');
  });

  it('resolves a single entity by id', async () => {
    enablePlatform();
    server.use(http.get(`${PLATFORM_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)));

    const { result } = renderHook(() => useEntity(ENTITY_ID), { wrapper });

    await waitFor(() => expect(result.current.data?.entityId).toBe(ENTITY_ID));
  });

  it('exposes the error on a failed request', async () => {
    enablePlatform();
    server.use(http.get(`${PLATFORM_URL}/entity-learning/entities`, () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fetch when not on the platform', async () => {
    const handler = vi.fn(() => HttpResponse.json(entitiesResponse));
    server.use(http.get(`${PLATFORM_URL}/entity-learning/entities`, handler));

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useSignalTopics', () => {
  it('returns the raw topics response', async () => {
    enablePlatform();
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/topics`, () => HttpResponse.json(topicsResponse)),
    );

    const { result } = renderHook(() => useSignalTopics(ENTITY_ID, 'sentiment', '32'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.topics).toHaveLength(2);
    expect(result.current.data?.topics[0].coverage).toBeCloseTo(0.4846153846153846);
  });

  it('is gated until signalName and runId are provided', async () => {
    enablePlatform();
    const { result } = renderHook(() => useSignalTopics(ENTITY_ID, undefined, undefined), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
  });
});

describe('useTopicExamples', () => {
  it('returns the examples array', async () => {
    enablePlatform();
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/topics/89/examples`, () =>
        HttpResponse.json(topicExamplesResponse),
      ),
    );

    const { result } = renderHook(() => useTopicExamples(ENTITY_ID, '89', 'sentiment', '32'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].traceId).toBe('04cc25ff8b5db797aa0ab4f1ce8d41da');
  });
});

describe('useSignalPoints', () => {
  it('returns the points array including outliers', async () => {
    enablePlatform();
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/points`, () => HttpResponse.json(pointsResponse)),
    );

    const { result } = renderHook(() => useSignalPoints(ENTITY_ID, 'sentiment', '32'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.some(point => point.isOutlier)).toBe(true);
  });
});

describe('observability endpoint', () => {
  it('fetches from MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT when set', async () => {
    enableObservability();
    server.use(http.get(`${OBSERVABILITY_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)));

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].entityId).toBe(ENTITY_ID);
  });

  it('takes precedence over MASTRA_CLOUD_API_ENDPOINT', async () => {
    enablePlatform();
    enableObservability();
    const cloudHandler = vi.fn(() => HttpResponse.json(entitiesResponse));
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, cloudHandler),
      http.get(`${OBSERVABILITY_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)),
    );

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cloudHandler).not.toHaveBeenCalled();
  });

  it('does not fetch when neither endpoint is set', async () => {
    const handler = vi.fn(() => HttpResponse.json(entitiesResponse));
    server.use(http.get(`${OBSERVABILITY_URL}/entity-learning/entities`, handler));

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('org/project scoping headers', () => {
  it('attaches x-organization-id and x-project-id when set', async () => {
    enablePlatform();
    window.MASTRA_ORGANIZATION_ID = 'org_123';
    window.MASTRA_PLATFORM_PROJECT_ID = 'resource_456';

    let organizationId: string | null = null;
    let projectId: string | null = null;
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, ({ request }) => {
        organizationId = request.headers.get('x-organization-id');
        projectId = request.headers.get('x-project-id');
        return HttpResponse.json(entitiesResponse);
      }),
    );

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(organizationId).toBe('org_123');
    expect(projectId).toBe('resource_456');
  });

  it('omits the scoping headers when not set', async () => {
    enablePlatform();

    let hasOrganizationId = true;
    let hasProjectId = true;
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, ({ request }) => {
        hasOrganizationId = request.headers.has('x-organization-id');
        hasProjectId = request.headers.has('x-project-id');
        return HttpResponse.json(entitiesResponse);
      }),
    );

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hasOrganizationId).toBe(false);
    expect(hasProjectId).toBe(false);
  });
});
