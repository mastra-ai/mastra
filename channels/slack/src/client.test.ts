import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SlackManifestClient } from './client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SlackManifestClient', () => {
  let client: SlackManifestClient;
  let onTokenRotation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTokenRotation = vi.fn().mockResolvedValue(undefined);
    client = new SlackManifestClient({
      token: 'initial-token',
      refreshToken: 'initial-refresh',
      onTokenRotation,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTokens / setTokens', () => {
    it('returns initial tokens', () => {
      expect(client.getTokens()).toEqual({
        token: 'initial-token',
        refreshToken: 'initial-refresh',
      });
    });

    it('updates tokens via setTokens', () => {
      client.setTokens({ token: 'new-t', refreshToken: 'new-rt' });
      expect(client.getTokens()).toEqual({ token: 'new-t', refreshToken: 'new-rt' });
    });
  });

  describe('rotateToken', () => {
    it('rotates tokens and calls onTokenRotation', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ ok: true, token: 'rotated-token', refresh_token: 'rotated-refresh' }),
      );

      await client.rotateToken();

      expect(client.getTokens()).toEqual({
        token: 'rotated-token',
        refreshToken: 'rotated-refresh',
      });
      expect(onTokenRotation).toHaveBeenCalledWith({
        token: 'rotated-token',
        refreshToken: 'rotated-refresh',
      });
    });

    it('throws on invalid_refresh_token with helpful message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_refresh_token' }));

      await expect(client.rotateToken()).rejects.toThrow('Slack refresh token is invalid');
    });

    it('throws on generic error', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'some_error' }));

      await expect(client.rotateToken()).rejects.toThrow('Token rotation failed: some_error');
    });

    it('throws when response is missing token fields', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await expect(client.rotateToken()).rejects.toThrow('incomplete data');
    });

    it('deduplicates concurrent rotations (shared promise)', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ok: true, token: 'rotated-token', refresh_token: 'rotated-refresh' }));

      // Fire 3 concurrent rotations
      const results = await Promise.all([client.rotateToken(), client.rotateToken(), client.rotateToken()]);

      // Only one fetch call should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(results).toEqual([undefined, undefined, undefined]);
    });

    it('allows subsequent rotations after the first completes', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 't1', refresh_token: 'rt1' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 't2', refresh_token: 'rt2' }));

      await client.rotateToken();
      expect(client.getTokens().token).toBe('t1');

      await client.rotateToken();
      expect(client.getTokens().token).toBe('t2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears the shared promise on error so retries work', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'transient' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 't1', refresh_token: 'rt1' }));

      await expect(client.rotateToken()).rejects.toThrow('transient');
      // Should be able to retry
      await client.rotateToken();
      expect(client.getTokens().token).toBe('t1');
    });
  });

  describe('createApp', () => {
    const manifest = { display_information: { name: 'Test' } } as any;

    it('rotates tokens then creates an app', async () => {
      mockFetch
        // rotateToken call
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        // createApp call
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            app_id: 'A123',
            credentials: {
              client_id: 'C1',
              client_secret: 'CS1',
              signing_secret: 'SS1',
            },
            oauth_authorize_url: 'https://slack.com/oauth/v2/authorize?client_id=C1',
          }),
        );

      const result = await client.createApp(manifest);

      expect(result).toEqual({
        appId: 'A123',
        clientId: 'C1',
        clientSecret: 'CS1',
        signingSecret: 'SS1',
        oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=C1',
      });

      // Verify the second call was to apps.manifest.create
      expect(mockFetch.mock.calls[1]?.[0]).toContain('apps.manifest.create');
    });

    it('throws with detailed errors from Slack', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(
          jsonResponse({
            ok: false,
            error: 'invalid_manifest',
            errors: [{ pointer: '/settings/event_subscriptions/request_url', message: 'invalid URL' }],
          }),
        );

      await expect(client.createApp(manifest)).rejects.toThrow('invalid_manifest');
    });

    it('throws when response is missing required fields', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true })); // missing app_id, credentials

      await expect(client.createApp(manifest)).rejects.toThrow('incomplete data');
    });
  });

  describe('deleteApp', () => {
    it('rotates tokens then deletes an app', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await expect(client.deleteApp('A123')).resolves.toBeUndefined();

      expect(mockFetch.mock.calls[1]?.[0]).toContain('apps.manifest.delete');
      const body = JSON.parse(mockFetch.mock.calls[1]?.[1]?.body);
      expect(body.app_id).toBe('A123');
    });

    it('throws on failure', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'app_not_found' }));

      await expect(client.deleteApp('A123')).rejects.toThrow('app_not_found');
    });
  });

  describe('updateApp', () => {
    it('rotates tokens then updates the manifest', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await expect(
        client.updateApp('A123', { display_information: { name: 'Updated' } } as any),
      ).resolves.toBeUndefined();

      expect(mockFetch.mock.calls[1]?.[0]).toContain('apps.manifest.update');
    });

    it('throws with detailed errors', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(
          jsonResponse({
            ok: false,
            error: 'invalid_manifest',
            errors: [{ pointer: '/features', message: 'bad config' }],
          }),
        );

      await expect(client.updateApp('A123', {} as any)).rejects.toThrow('invalid_manifest');
    });
  });

  describe('setAppIcon', () => {
    it('rotates tokens then sets the icon', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const imageData = new ArrayBuffer(8);
      await expect(client.setAppIcon('A123', imageData)).resolves.toBeUndefined();

      expect(mockFetch.mock.calls[1]?.[0]).toContain('apps.icon.set');
    });

    it('does not throw on failure (non-fatal)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ ok: true, token: 'rt', refresh_token: 'rrt' }))
        .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'too_large' }));

      await expect(client.setAppIcon('A123', new ArrayBuffer(8))).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('too_large'));
    });
  });
});
