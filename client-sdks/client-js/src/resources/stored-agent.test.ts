import { describe, expect, expectTypeOf, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type {
  ActivateAgentVersionResponse,
  AgentVersionLabel,
  ListAgentVersionLabelsResponse,
  ListAgentVersionsResponse,
  StoredAgentVersionIdentifier,
} from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('StoredAgent Resource', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('listStoredAgents', () => {
    it('should list stored agents', async () => {
      const mockResponse = {
        agents: [
          {
            id: 'agent-1',
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      };
      mockFetchResponse(mockResponse);

      const result = await client.listStoredAgents();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should round-trip the resolved `author` field on each list row', async () => {
      const mockResponse = {
        agents: [
          {
            id: 'agent-1',
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            authorId: 'author-1',
            author: { id: 'author-1', name: 'Alice', email: 'alice@example.com' },
          },
          {
            id: 'agent-2',
            name: 'Test Agent 2',
            instructions: 'x',
            model: { provider: 'openai', name: 'gpt-4' },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            authorId: 'author-2',
            // No `author` — server could not resolve this id.
          },
        ],
        total: 2,
        page: 0,
        perPage: 100,
        hasMore: false,
      };
      mockFetchResponse(mockResponse);

      const result = await client.listStoredAgents();
      expect(result.agents[0].author).toEqual({
        id: 'author-1',
        name: 'Alice',
        email: 'alice@example.com',
      });
      expect(result.agents[1].author).toBeUndefined();
    });

    it('should list stored agents with pagination', async () => {
      const mockResponse = {
        agents: [],
        total: 0,
        page: 1,
        perPage: 10,
        hasMore: false,
      };
      mockFetchResponse(mockResponse);

      const result = await client.listStoredAgents({ page: 1, perPage: 10 });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents?page=1&perPage=10`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should list stored agents with orderBy', async () => {
      const mockResponse = {
        agents: [],
        total: 0,
        page: 0,
        perPage: 100,
        hasMore: false,
      };
      mockFetchResponse(mockResponse);

      const result = await client.listStoredAgents({
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents?orderBy%5Bfield%5D=createdAt&orderBy%5Bdirection%5D=DESC`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should pass favoritedOnly and pinFavoritedFor on listStoredAgents', async () => {
      const mockResponse = { agents: [], total: 0, page: 0, perPage: 100, hasMore: false };
      mockFetchResponse(mockResponse);

      await client.listStoredAgents({ favoritedOnly: true, pinFavoritedFor: 'user-1' });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents?favoritedOnly=true&pinFavoritedFor=user-1`,
        expect.anything(),
      );
    });
  });

  describe('createStoredAgent', () => {
    it('should create a stored agent', async () => {
      const createParams = {
        id: 'new-agent',
        name: 'New Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };
      const mockResponse = {
        ...createParams,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockFetchResponse(mockResponse);

      const result = await client.createStoredAgent(createParams);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createParams),
          headers: expect.objectContaining({
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('should create a stored agent with all optional fields', async () => {
      const createParams = {
        id: 'full-agent',
        name: 'Full Agent',
        description: 'A fully configured agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: ['calculator', 'weather'],
        workflows: ['workflow-1'],
        agents: ['sub-agent-1'],
        memory: 'my-memory',
        scorers: {
          'my-scorer': { sampling: { type: 'ratio' as const, rate: 0.5 } },
        },
        metadata: { version: '1.0' },
      };
      const mockResponse = {
        ...createParams,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockFetchResponse(mockResponse);

      const result = await client.createStoredAgent(createParams);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getStoredAgent', () => {
    const storedAgentId = 'test-stored-agent';
    let storedAgent: ReturnType<typeof client.getStoredAgent>;

    beforeEach(() => {
      storedAgent = client.getStoredAgent(storedAgentId);
    });

    it('should get stored agent details', async () => {
      const mockResponse = {
        id: storedAgentId,
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.details();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it.each([
      [{ label: 'pr-101' }, 'label', 'pr-101'],
      [{ versionId: 'version-2' }, 'versionId', 'version-2'],
      [{ status: 'draft' }, 'status', 'draft'],
      [{ status: 'archived' }, 'status', 'archived'],
    ] as const)('should get stored agent details with selector %j', async (selector, expectedKey, expectedValue) => {
      mockFetchResponse({ id: storedAgentId, resolvedVersionId: 'version-2' });
      const requestContext = { tenantId: 'tenant-1' };

      await storedAgent.details(requestContext, selector satisfies StoredAgentVersionIdentifier);

      const requestedUrl = new URL((global.fetch as any).mock.calls[0][0]);
      expect(requestedUrl.pathname).toBe(`/api/stored/agents/${storedAgentId}`);
      expect(requestedUrl.searchParams.get(expectedKey)).toBe(expectedValue);
      expect(requestedUrl.searchParams.get('requestContext')).toBe(btoa(JSON.stringify(requestContext)));
    });

    it('should round-trip the resolved `author` field on details()', async () => {
      const mockResponse = {
        id: storedAgentId,
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        authorId: 'author-1',
        author: {
          id: 'author-1',
          name: 'Alice',
          email: 'alice@example.com',
          avatarUrl: 'https://x/y.png',
        },
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.details();
      // Type-level: StoredAgentResponse#author is optional ResolvedAuthor — this assignment compiles.
      const author: { id: string; name?: string; email?: string; avatarUrl?: string } | undefined = result.author;
      expect(author).toEqual(mockResponse.author);
    });

    it('should update stored agent', async () => {
      const updateParams = {
        name: 'Updated Agent Name',
        instructions: 'Updated instructions',
      };
      const mockResponse = {
        id: storedAgentId,
        ...updateParams,
        model: { provider: 'openai', name: 'gpt-4' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.update(updateParams);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateParams),
        }),
      );
    });

    it('should export stored agent JSON', async () => {
      const params = { instructions: 'Updated instructions' };
      const mockResponse = {
        agentId: storedAgentId,
        fileName: `agents/${storedAgentId}.json`,
        content: '{\n  "instructions": "Updated instructions"\n}\n',
        config: { instructions: 'Updated instructions' },
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.export(params);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/export`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params),
        }),
      );
    });

    it('should open a stored agent change request', async () => {
      const params = {
        instructions: 'Updated instructions',
        changeMessage: 'Tune weather instructions',
        userName: 'Ada Lovelace',
      };
      const mockResponse = {
        id: '123',
        url: 'https://github.com/acme/repo/pull/123',
        ref: 'mastra/source-storage/test',
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.openChangeRequest(params);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/change-request`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params),
        }),
      );
    });

    it('should delete stored agent', async () => {
      const mockResponse = {
        success: true,
        message: `Agent ${storedAgentId} deleted successfully`,
      };
      mockFetchResponse(mockResponse);

      const result = await storedAgent.delete();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    describe('Favorites', () => {
      it('should favorite the agent via PUT /favorite', async () => {
        const mockResponse = { favorited: true, favoriteCount: 3 };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.favorite();
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/favorite`,
          expect.objectContaining({
            method: 'PUT',
          }),
        );
      });

      it('should unfavorite the agent via DELETE /favorite', async () => {
        const mockResponse = { favorited: false, favoriteCount: 2 };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.unfavorite();
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/favorite`,
          expect.objectContaining({
            method: 'DELETE',
          }),
        );
      });
    });

    it('should handle special characters in storedAgentId', async () => {
      const specialId = 'agent/with/slashes';
      const encodedId = encodeURIComponent(specialId);
      const specialStoredAgent = client.getStoredAgent(specialId);

      const mockResponse = {
        id: specialId,
        name: 'Special Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockFetchResponse(mockResponse);

      await specialStoredAgent.details();
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/agents/${encodedId}`,
        expect.anything(),
      );
    });

    describe('Version Management', () => {
      it('should list version labels with pagination and request context', async () => {
        const mockResponse: ListAgentVersionLabelsResponse = {
          labels: [
            {
              name: 'pr-101',
              kind: 'custom',
              versionId: 'version-1',
              versionNumber: 1,
              revisionToken: 'revision-1',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          pagination: { total: 1, page: 1, perPage: 5, hasMore: false },
        };
        mockFetchResponse(mockResponse);

        const requestContext = { tenantId: 'tenant-1' };
        const result = await storedAgent.listVersionLabels({ page: 1, perPage: 5 }, requestContext);

        expectTypeOf(result).toEqualTypeOf<ListAgentVersionLabelsResponse>();
        expect(result).toEqual(mockResponse);
        const requestedUrl = new URL((global.fetch as any).mock.calls[0][0]);
        expect(requestedUrl.pathname).toBe(`/api/stored/agents/${storedAgentId}/labels`);
        expect(requestedUrl.searchParams.get('page')).toBe('1');
        expect(requestedUrl.searchParams.get('perPage')).toBe('5');
        expect(requestedUrl.searchParams.get('requestContext')).toBe(btoa(JSON.stringify(requestContext)));
      });

      it('should set a version label with an encoded path and CAS body', async () => {
        const mockResponse: AgentVersionLabel = {
          name: 'preview/one',
          kind: 'custom',
          versionId: 'version-2',
          versionNumber: 2,
          revisionToken: 'revision-2',
        };
        mockFetchResponse(mockResponse);

        const input = { versionId: 'version-2', expectedRevisionToken: null };
        const result = await storedAgent.setVersionLabel('preview/one', input, { tenantId: 'tenant-1' });

        expectTypeOf(result).toEqualTypeOf<AgentVersionLabel>();
        expect(result).toEqual(mockResponse);
        const [url, init] = (global.fetch as any).mock.calls[0];
        const requestedUrl = new URL(url);
        expect(requestedUrl.pathname).toBe(`/api/stored/agents/${storedAgentId}/labels/preview%2Fone`);
        expect(requestedUrl.searchParams.has('requestContext')).toBe(true);
        expect(init).toEqual(
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(input),
          }),
        );
      });

      it('should delete a version label with an encoded revision token and request context', async () => {
        const mockResponse = { success: true as const, deleted: true };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.deleteVersionLabel(
          'pr-101',
          { expectedRevisionToken: 'revision/+ 1' },
          { tenantId: 'tenant-1' },
        );

        expect(result).toEqual(mockResponse);
        const [url, init] = (global.fetch as any).mock.calls[0];
        const requestedUrl = new URL(url);
        expect(requestedUrl.pathname).toBe(`/api/stored/agents/${storedAgentId}/labels/pr-101`);
        expect(requestedUrl.searchParams.get('expectedRevisionToken')).toBe('revision/+ 1');
        expect(requestedUrl.searchParams.has('requestContext')).toBe(true);
        expect(init).toEqual(expect.objectContaining({ method: 'DELETE' }));
      });

      it('should make each version-label CAS mutation and conditional activation a single network attempt', async () => {
        const mutationStoredAgent = new MastraClient({ ...clientOptions, retries: 3, backoffMs: 0 }).getStoredAgent(
          storedAgentId,
        );
        const mockErrorResponse = (status: number) => {
          (global.fetch as any).mockImplementation(async () =>
            new Response(JSON.stringify({ error: `HTTP ${status}` }), {
              status,
              statusText: 'Request failed',
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        };

        mockErrorResponse(501);
        await expect(
          mutationStoredAgent.setVersionLabel('pr-101', {
            versionId: 'version-1',
            expectedRevisionToken: null,
          }),
        ).rejects.toMatchObject({ status: 501 });
        expect(global.fetch).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();
        mockErrorResponse(503);
        await expect(
          mutationStoredAgent.deleteVersionLabel('pr-101', { expectedRevisionToken: 'revision-1' }),
        ).rejects.toMatchObject({ status: 503 });
        expect(global.fetch).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();
        mockErrorResponse(500);
        await expect(
          mutationStoredAgent.activateVersion({ versionId: 'version-2', expectedActiveVersionId: 'version-1' }),
        ).rejects.toMatchObject({ status: 500 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should list versions for stored agent', async () => {
        const mockResponse = {
          versions: [
            {
              id: 'version-1',
              agentId: storedAgentId,
              versionNumber: 1,
              name: 'v1',
              snapshot: {
                id: storedAgentId,
                name: 'Test Agent',
                instructions: 'You are a helpful assistant',
                model: { provider: 'openai', name: 'gpt-4' },
              },
              changedFields: ['instructions'],
              changeMessage: 'Updated instructions',
              createdAt: '2024-01-01T00:00:00.000Z',
              labels: ['latest', 'pr-101'],
            },
          ],
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.listVersions();
        expect(result).toEqual(mockResponse);
        expect(result.versions[0]?.labels).toEqual(['latest', 'pr-101']);
        expectTypeOf(result).toEqualTypeOf<ListAgentVersionsResponse>();
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should list versions with pagination and sorting', async () => {
        const mockResponse = {
          versions: [],
          total: 0,
          page: 1,
          perPage: 5,
          hasMore: false,
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.listVersions({
          page: 1,
          perPage: 5,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions?page=1&perPage=5&orderBy%5Bfield%5D=createdAt&orderBy%5Bdirection%5D=DESC`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should create a version', async () => {
        const createParams = {
          name: 'Production Release',
          changeMessage: 'Stable version for production',
        };
        const mockResponse = {
          id: 'version-new',
          agentId: storedAgentId,
          versionNumber: 2,
          name: createParams.name,
          snapshot: {
            id: storedAgentId,
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
          },
          changedFields: [],
          changeMessage: createParams.changeMessage,
          createdAt: '2024-01-02T00:00:00.000Z',
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.createVersion(createParams);
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(createParams),
            headers: expect.objectContaining({
              'content-type': 'application/json',
            }),
          }),
        );
      });

      it('should create a version without params', async () => {
        const mockResponse = {
          id: 'version-auto',
          agentId: storedAgentId,
          versionNumber: 3,
          snapshot: {
            id: storedAgentId,
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
          },
          changedFields: [],
          createdAt: '2024-01-03T00:00:00.000Z',
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.createVersion();
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({}),
          }),
        );
      });

      it('should get a specific version', async () => {
        const versionId = 'version-1';
        const mockResponse = {
          id: versionId,
          agentId: storedAgentId,
          versionNumber: 1,
          name: 'v1',
          snapshot: {
            id: storedAgentId,
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
          },
          changedFields: ['instructions'],
          changeMessage: 'Updated instructions',
          createdAt: '2024-01-01T00:00:00.000Z',
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.getVersion(versionId);
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should activate a version', async () => {
        const versionId = 'version-1';
        const mockResponse = {
          success: true,
          message: 'Version 1 is now active',
          activeVersionId: versionId,
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.activateVersion(versionId);
        expect(result).toEqual(mockResponse);
        expectTypeOf(result).toEqualTypeOf<ActivateAgentVersionResponse>();
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}/activate`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
        expect((global.fetch as any).mock.calls[0][1].body).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should preserve configured retries for legacy activation', async () => {
        const retryingStoredAgent = new MastraClient({ ...clientOptions, retries: 3, backoffMs: 0 }).getStoredAgent(
          storedAgentId,
        );
        const versionId = 'version-1';
        const successfulResponse = new Response(undefined, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        successfulResponse.json = () =>
          Promise.resolve({ success: true, message: 'Version 1 is now active', activeVersionId: versionId });
        (global.fetch as any)
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'Temporary failure' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
          .mockResolvedValueOnce(successfulResponse);

        await expect(retryingStoredAgent.activateVersion(versionId)).resolves.toMatchObject({
          activeVersionId: versionId,
        });

        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should activate a version with an active-version precondition', async () => {
        const versionId = 'version-2';
        const mockResponse: ActivateAgentVersionResponse = {
          success: true,
          message: 'Version 2 is now active',
          activeVersionId: versionId,
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.activateVersion(
          { versionId, expectedActiveVersionId: 'version-1' },
          { tenantId: 'tenant-1' },
        );

        expectTypeOf(result).toEqualTypeOf<ActivateAgentVersionResponse>();
        expect(result).toEqual(mockResponse);
        const [requestedUrl, requestInit] = (global.fetch as any).mock.calls[0];
        const url = new URL(requestedUrl);
        expect(`${url.origin}${url.pathname}`).toBe(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}/activate`,
        );
        expect(url.searchParams.get('requestContext')).toBe(btoa(JSON.stringify({ tenantId: 'tenant-1' })));
        expect(requestInit).toEqual(
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ expectedActiveVersionId: 'version-1' }),
          }),
        );
      });

      it('should keep a legacy activation request context body-less', async () => {
        const versionId = 'version-1';
        const requestContext = { expectedActiveVersionId: 'context-value' };
        mockFetchResponse({ success: true, message: 'Already active', activeVersionId: versionId });

        await storedAgent.activateVersion(versionId, requestContext);

        const [requestedUrl, requestInit] = (global.fetch as any).mock.calls[0];
        const url = new URL(requestedUrl);
        expect(url.searchParams.get('requestContext')).toBe(btoa(JSON.stringify(requestContext)));
        expect(requestInit.body).toBeUndefined();
      });

      it('should restore a version', async () => {
        const versionId = 'version-1';
        const mockResponse = {
          id: 'version-new',
          agentId: storedAgentId,
          versionNumber: 4,
          name: 'Restored from v1',
          snapshot: {
            id: storedAgentId,
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model: { provider: 'openai', name: 'gpt-4' },
          },
          changedFields: ['instructions'],
          changeMessage: 'Restored from version 1',
          createdAt: '2024-01-04T00:00:00.000Z',
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.restoreVersion(versionId);
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}/restore`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should delete a version', async () => {
        const versionId = 'version-1';
        const mockResponse = {
          success: true,
          message: 'Version deleted successfully',
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.deleteVersion(versionId);
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}`,
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should compare two versions', async () => {
        const fromId = 'version-1';
        const toId = 'version-2';
        const mockResponse = {
          fromVersion: {
            id: fromId,
            agentId: storedAgentId,
            versionNumber: 1,
            snapshot: {
              id: storedAgentId,
              name: 'Test Agent',
              instructions: 'You are a helpful assistant',
              model: { provider: 'openai', name: 'gpt-4' },
            },
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          toVersion: {
            id: toId,
            agentId: storedAgentId,
            versionNumber: 2,
            snapshot: {
              id: storedAgentId,
              name: 'Test Agent',
              instructions: 'You are a very helpful assistant',
              model: { provider: 'openai', name: 'gpt-4' },
            },
            createdAt: '2024-01-02T00:00:00.000Z',
          },
          diffs: [
            {
              field: 'instructions',
              previousValue: 'You are a helpful assistant',
              currentValue: 'You are a very helpful assistant',
              changeType: 'modified' as const,
            },
          ],
        };
        mockFetchResponse(mockResponse);

        const result = await storedAgent.compareVersions(fromId, toId);
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/compare?from=${fromId}&to=${toId}`,
          expect.objectContaining({
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
      });

      it('should handle special characters in version IDs', async () => {
        const versionId = 'version/with/slashes';
        const encodedVersionId = encodeURIComponent(versionId);
        const mockResponse = {
          id: versionId,
          agentId: storedAgentId,
          versionNumber: 1,
          snapshot: {
            id: storedAgentId,
            name: 'Test Agent',
            instructions: 'Test',
            model: { provider: 'openai', name: 'gpt-4' },
          },
          changedFields: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        };
        mockFetchResponse(mockResponse);

        await storedAgent.getVersion(versionId);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${encodedVersionId}`,
          expect.anything(),
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle 404 error for non-existent agent', async () => {
        const errorResponse = new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        });
        (global.fetch as any).mockResolvedValueOnce(errorResponse);

        await expect(storedAgent.details()).rejects.toThrow();
      });

      it('should handle 500 error', async () => {
        const errorResponse = new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        });
        (global.fetch as any).mockResolvedValueOnce(errorResponse);

        await expect(storedAgent.update({ name: 'New Name' })).rejects.toThrow();
      });

      it('should handle network errors', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        await expect(storedAgent.details()).rejects.toThrow();
      });
    });
  });
});
