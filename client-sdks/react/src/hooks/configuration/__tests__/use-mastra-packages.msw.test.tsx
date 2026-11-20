// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useMastraPackages } from '../use-mastra-packages';

const packages: Awaited<ReturnType<MastraClient['getSystemPackages']>> = {
  packages: [{ name: '@mastra/core', version: '1.0.0' }],
  isDev: true,
  cmsEnabled: false,
  liveKitConnectionRouteEnabled: false,
  observabilityEnabled: false,
};

afterEach(() => cleanup());

describe('useMastraPackages', () => {
  describe('when the server reports installed packages', () => {
    it('returns the packages', async () => {
      server.use(http.get('*/api/system/packages', () => HttpResponse.json(packages)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useMastraPackages(), { wrapper });
      await waitFor(() => expect(result.current.data?.packages[0]?.name).toBe('@mastra/core'));
    });
  });
});
