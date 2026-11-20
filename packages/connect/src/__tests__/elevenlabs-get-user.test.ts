import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { getUserTool } from '../providers/elevenlabs/tools/get-user.js';
import { createPlatformProxy } from '../runtime/platform-proxy.js';

describe('elevenlabs_get_user', () => {
  it('never returns the account API key that ElevenLabs echoes in GET /v1/user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        user_id: 'user-1',
        xi_api_key: 'sk_live_secret',
        is_api_key_hashed: false,
        xi_api_key_preview: 'sk_…cret',
        first_name: 'Ada',
      }),
    );
    const proxy = createPlatformProxy({
      connectionId: 'conn-1',
      client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });

    const output = await getUserTool(proxy).execute!({}, { requestContext: new RequestContext() } as never);

    expect(fetchMock.mock.calls[0]![0]).toBe('https://example.test/v2/connections/conn-1/proxy/v1/user');
    expect(output).toEqual({
      user_id: 'user-1',
      is_api_key_hashed: false,
      xi_api_key_preview: 'sk_…cret',
      first_name: 'Ada',
    });
    expect(JSON.stringify(output)).not.toContain('sk_live_secret');
  });
});
