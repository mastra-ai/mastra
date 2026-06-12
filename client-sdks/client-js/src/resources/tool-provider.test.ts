import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('ToolProvider Resource', () => {
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

  it('listToolProviders hits the registry endpoint', async () => {
    const mockResponse = {
      providers: [
        {
          id: 'composio',
          displayName: 'Composio',
          capabilities: {
            multipleConnectionsPerToolkit: true,
            batchConnectionStatus: true,
            reauthorizeReusesConnectionId: true,
          },
        },
      ],
    };
    mockFetchResponse(mockResponse);

    const result = await client.listToolProviders();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/tool-providers`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  describe('getToolProvider("composio")', () => {
    const providerId = 'composio';
    let provider: ReturnType<typeof client.getToolProvider>;

    beforeEach(() => {
      provider = client.getToolProvider(providerId);
    });

    it('listToolkits', async () => {
      const mockResponse = { data: [{ slug: 'gmail', name: 'Gmail' }] };
      mockFetchResponse(mockResponse);

      const result = await provider.listToolkits();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/toolkits`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('listTools with no params', async () => {
      const mockResponse = { data: [], pagination: { page: 1, hasMore: false } };
      mockFetchResponse(mockResponse);

      const result = await provider.listTools();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/tools`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('listTools with filters + pagination', async () => {
      const mockResponse = {
        data: [{ slug: 'gmail.fetch', name: 'Fetch', toolkit: 'gmail' }],
        pagination: { page: 2, perPage: 10, hasMore: true },
      };
      mockFetchResponse(mockResponse);

      const result = await provider.listTools({
        toolkit: 'gmail',
        search: 'fetch',
        page: 2,
        perPage: 10,
      });
      expect(result).toEqual(mockResponse);

      const callUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(callUrl).toContain(`${clientOptions.baseUrl}/api/tool-providers/composio/tools?`);
      expect(callUrl).toContain('toolkit=gmail');
      expect(callUrl).toContain('search=fetch');
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('perPage=10');
    });

    it('authorize POSTs the body and returns redirect + authId', async () => {
      const mockResponse = { url: 'https://oauth/redirect', authId: 'auth-123' };
      mockFetchResponse(mockResponse);

      const body = { toolkit: 'gmail', connectionId: 'conn-1', toolName: 'gmail.fetch' };
      const result = await provider.authorize(body);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/authorize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });

    it('getAuthStatus polls the auth-status endpoint', async () => {
      const mockResponse = { status: 'completed' };
      mockFetchResponse(mockResponse);

      const result = await provider.getAuthStatus('auth-123');
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/auth-status/auth-123`,
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
          { connectionId: 'conn-1', toolkit: 'gmail' },
          { connectionId: 'conn-2', toolkit: 'gmail' },
        ],
      };
      const result = await provider.getConnectionStatus(body);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/connection-status`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });

    it('updateConnection PATCHes the connection row with the new label', async () => {
      const mockResponse = { ok: true, label: 'Work' };
      mockFetchResponse(mockResponse);

      const result = await provider.updateConnection('conn-1', { label: 'Work' });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/connections/conn-1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ label: 'Work' }),
        }),
      );
    });

    it('updateConnection accepts null to clear the label', async () => {
      const mockResponse = { ok: true, label: null };
      mockFetchResponse(mockResponse);

      const result = await provider.updateConnection('conn-1', { label: null });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/connections/conn-1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ label: null }),
        }),
      );
    });

    it('getHealth hits the health endpoint', async () => {
      const mockResponse = { ok: true };
      mockFetchResponse(mockResponse);

      const result = await provider.getHealth();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/tool-providers/composio/health`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });
});
