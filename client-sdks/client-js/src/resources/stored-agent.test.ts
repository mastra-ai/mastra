import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

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
          orderBy: 'createdAt',
          sortDirection: 'DESC',
        });
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions?page=1&perPage=5&orderBy=createdAt&sortDirection=DESC`,
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
        mockFetchResponse(undefined);

        await storedAgent.activateVersion(versionId);
        expect(global.fetch).toHaveBeenCalledWith(
          `${clientOptions.baseUrl}/api/stored/agents/${storedAgentId}/versions/${versionId}/activate`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining(clientOptions.headers),
          }),
        );
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
        mockFetchResponse(undefined);

        await storedAgent.deleteVersion(versionId);
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
        const errorResponse = new Response(
          JSON.stringify({ error: 'Agent not found' }),
          {
            status: 404,
            statusText: 'Not Found',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          },
        );
        (global.fetch as any).mockResolvedValueOnce(errorResponse);

        await expect(storedAgent.details()).rejects.toThrow();
      });

      it('should handle 500 error', async () => {
        const errorResponse = new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          },
        );
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
