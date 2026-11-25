import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authHandler, renderSidebar, systemPackagesHandler } from './render-sidebar';
import { server } from '@/test/msw-server';

const authDisabledCapabilities = {
  enabled: false,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

beforeEach(() => {
  // Keep useMastraPlatform off so the platform filter does not run.
  (window as unknown as Record<string, unknown>).MASTRA_CLOUD_API_ENDPOINT = '';
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

describe('AppSidebar — Knowledge link', () => {
  describe('when the server has not registered the Knowledge routes', () => {
    it('still shows the link, so the page can explain how to enable them', async () => {
      // No `/api/knowledge` handler: listing the routes would be an unhandled request.
      server.use(authHandler(authDisabledCapabilities), systemPackagesHandler());

      renderSidebar('/agents');

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /^knowledge$/i })).not.toBeNull();
      });
    });
  });
});
