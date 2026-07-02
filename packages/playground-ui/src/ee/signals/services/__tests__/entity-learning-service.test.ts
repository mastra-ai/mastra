import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createEntityLearningService } from '../entity-learning-service';
import {
  entitiesResponse,
  learningResponse,
  outliersResponse,
  pointsResponse,
  runResponse,
  runsResponse,
  topicExamplesResponse,
  topicResponse,
  topicsResponse,
} from './fixtures/entity-learning';

const BASE_URL = 'https://observability.test';
const ROOT = `${BASE_URL}/entity-learning`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createEntityLearningService', () => {
  describe('when no org/project scoping is configured', () => {
    const service = createEntityLearningService({ baseUrl: BASE_URL });

    it('fetches typed entities from /entities', async () => {
      server.use(http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)));

      const result = await service.getEntities();

      expect(result).toEqual(entitiesResponse);
    });

    it('does not append organizationId or projectId query params', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(entitiesResponse);
        }),
      );

      await service.getEntities();

      expect(capturedUrl?.searchParams.has('organizationId')).toBe(false);
      expect(capturedUrl?.searchParams.has('projectId')).toBe(false);
    });
  });

  describe('when org and project scoping is configured', () => {
    const service = createEntityLearningService({
      baseUrl: `${BASE_URL}/`,
      organizationId: 'org-1',
      projectId: 'proj-1',
    });

    it('trims the trailing slash and scopes every request with org and project ids', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(entitiesResponse);
        }),
      );

      await service.getEntities();

      expect(capturedUrl?.pathname).toBe('/entity-learning/entities');
      expect(capturedUrl?.origin).toBe(BASE_URL);
      expect(capturedUrl?.searchParams.get('organizationId')).toBe('org-1');
      expect(capturedUrl?.searchParams.get('projectId')).toBe('proj-1');
    });

    it('passes signalName to /runs', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/runs`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(runsResponse);
        }),
      );

      const result = await service.getEntityRuns('entity_support', 'sentiment');

      expect(result).toEqual(runsResponse);
      expect(capturedUrl?.searchParams.get('signalName')).toBe('sentiment');
    });

    it('builds the /runs/:runId path with signalName', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/runs/:runId`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(runResponse);
        }),
      );

      const result = await service.getEntityRun('entity_support', '32', 'sentiment');

      expect(result).toEqual(runResponse);
      expect(capturedUrl?.pathname).toBe('/entity-learning/entities/entity_support/runs/32');
      expect(capturedUrl?.searchParams.get('signalName')).toBe('sentiment');
    });

    it('omits runId from /learning when not provided', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/learning`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(learningResponse);
        }),
      );

      await service.getEntityLearning('entity_support', 'sentiment');

      expect(capturedUrl?.searchParams.has('runId')).toBe(false);
    });

    it('includes runId in /learning when provided', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/learning`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(learningResponse);
        }),
      );

      await service.getEntityLearning('entity_support', 'sentiment', '32');

      expect(capturedUrl?.searchParams.get('runId')).toBe('32');
    });

    it('fetches topics (clusters) with signalName and runId', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/topics`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(topicsResponse);
        }),
      );

      const result = await service.getEntityTopics('entity_support', 'sentiment', '32');

      expect(result).toEqual(topicsResponse);
      expect(capturedUrl?.searchParams.get('signalName')).toBe('sentiment');
      expect(capturedUrl?.searchParams.get('runId')).toBe('32');
    });

    it('fetches a single topic by id', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/topics/:topicId`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(topicResponse);
        }),
      );

      const result = await service.getEntityTopic('entity_support', '89', 'sentiment', '32');

      expect(result).toEqual(topicResponse);
      expect(capturedUrl?.pathname).toBe('/entity-learning/entities/entity_support/topics/89');
    });

    it('passes limit to topic examples', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(topicExamplesResponse);
        }),
      );

      const result = await service.getEntityTopicExamples('entity_support', '89', {
        signalName: 'sentiment',
        runId: '32',
        limit: 25,
      });

      expect(result).toEqual(topicExamplesResponse);
      expect(capturedUrl?.searchParams.get('limit')).toBe('25');
    });

    it('passes includeOutliers to /points', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/points`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(pointsResponse);
        }),
      );

      const result = await service.getEntityPoints('entity_support', {
        signalName: 'sentiment',
        runId: '32',
        includeOutliers: true,
      });

      expect(result).toEqual(pointsResponse);
      expect(capturedUrl?.searchParams.get('includeOutliers')).toBe('true');
    });

    it('fetches outliers', async () => {
      server.use(http.get(`${ROOT}/entities/:entityId/outliers`, () => HttpResponse.json(outliersResponse)));

      const result = await service.getEntityOutliers('entity_support', 'sentiment', '32');

      expect(result).toEqual(outliersResponse);
    });

    it('fetches outlier examples', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/entities/:entityId/outliers/examples`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(topicExamplesResponse);
        }),
      );

      const result = await service.getEntityOutlierExamples('entity_support', {
        signalName: 'sentiment',
        runId: '32',
      });

      expect(result).toEqual(topicExamplesResponse);
      expect(capturedUrl?.pathname).toBe('/entity-learning/entities/entity_support/outliers/examples');
    });
  });

  describe('when the server responds with a non-ok status', () => {
    const service = createEntityLearningService({ baseUrl: BASE_URL });

    it('throws an error including the status code', async () => {
      server.use(http.get(`${ROOT}/entities`, () => new HttpResponse(null, { status: 503 })));

      await expect(service.getEntities()).rejects.toThrow('503');
    });
  });
});
