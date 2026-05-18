import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('ToolIntegration Resource', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  const mockFetchResponse = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('listToolIntegrations hits the registry endpoint', async () => {
    const mockResponse = {
      integrations: [
        {
          id: 'composio',
          displayName: 'Composio',
          capabilities: {
            multipleConnectionsPerService: true,
            batchConnectionStatus: true,
            reauthorizeReusesConnectionId: true,
          },
        },
      ],
    };
    mockFetchResponse(mockResponse);

    const result = await client.listToolIntegrations();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/tool-integrations`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  describe('getToolIntegration("composio")', () => {
    const integrationId = 'composio';
    let integration: ReturnType<typeof client.getToolIntegration>;

    beforeEach(() => {
      integration = client.getToolIntegration(integrationId);
    });

    it('listToolServices', async () => {
      const mockResponse = { data: [{ slug: 'gmail', name: 'Gmail' }] };
      mockFetchResponse(mockResponse);

      const result = await integration.listToolServices();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/tool-services`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('listTools with no params', async () => {
      const mockResponse = { data: [], pagination: { page: 1, hasMore: false } };
      mockFetchResponse(mockResponse);

      const result = await integration.listTools();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/tools`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('listTools with filters + pagination', async () => {
      const mockResponse = {
        data: [{ slug: 'gmail.fetch', name: 'Fetch', toolService: 'gmail' }],
        pagination: { page: 2, perPage: 10, hasMore: true },
      };
      mockFetchResponse(mockResponse);

      const result = await integration.listTools({
        toolService: 'gmail',
        search: 'fetch',
        page: 2,
        perPage: 10,
      });
      expect(result).toEqual(mockResponse);

      const callUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(callUrl).toContain(`${clientOptions.baseUrl}/api/tool-integrations/composio/tools?`);
      expect(callUrl).toContain('toolService=gmail');
      expect(callUrl).toContain('search=fetch');
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('perPage=10');
    });

    it('authorize POSTs the body and returns redirect + authId', async () => {
      const mockResponse = { url: 'https://oauth/redirect', authId: 'auth-123' };
      mockFetchResponse(mockResponse);

      const body = { toolService: 'gmail', connectionId: 'conn-1', toolName: 'gmail.fetch' };
      const result = await integration.authorize(body);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/authorize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });

    it('getAuthStatus polls the auth-status endpoint', async () => {
      const mockResponse = { status: 'completed' };
      mockFetchResponse(mockResponse);

      const result = await integration.getAuthStatus('auth-123');
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/auth-status/auth-123`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('getConnectionStatus POSTs items', async () => {
      const mockResponse = {
        items: {
          'conn-1': { connected: true },
          'conn-2': { connected: false },
        },
      };
      mockFetchResponse(mockResponse);

      const body = {
        items: [
          { connectionId: 'conn-1', toolService: 'gmail' },
          { connectionId: 'conn-2', toolService: 'gmail' },
        ],
      };
      const result = await integration.getConnectionStatus(body);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/connection-status`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });

    it('getHealth hits the health endpoint', async () => {
      const mockResponse = { ok: true };
      mockFetchResponse(mockResponse);

      const result = await integration.getHealth();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-integrations/composio/health`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });
});
