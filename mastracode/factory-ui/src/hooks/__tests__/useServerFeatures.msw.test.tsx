import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useServerFeatures } from '../useServerFeatures';

describe('useServerFeatures', () => {
  describe('when the server enables experimental knowledge', () => {
    it('exposes the enabled capability to UI gates', async () => {
      server.use(http.get(`${TEST_BASE_URL}/web/config/features`, () => HttpResponse.json({ knowledge: true })));

      const { result } = renderHookWithProviders(() => useServerFeatures());

      await waitFor(() => expect(result.current.data).toEqual({ knowledge: true }));
    });
  });
});
