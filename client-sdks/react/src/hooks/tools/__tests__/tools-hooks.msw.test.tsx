// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useTools } from '../use-all-tools';
import { useExecuteTool } from '../use-execute-tool';

const tools: Awaited<ReturnType<MastraClient['listTools']>> = {
  weather: { id: 'weather', description: 'Get the weather' },
};

afterEach(() => cleanup());

describe('useTools', () => {
  describe('when the server lists tools', () => {
    it('returns tools keyed by id', async () => {
      server.use(http.get('*/api/tools', () => HttpResponse.json(tools)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useTools(), { wrapper });
      await waitFor(() => expect(Object.keys(result.current.data ?? {})).toEqual(['weather']));
    });
  });
});

describe('useExecuteTool', () => {
  describe('when the tool executes', () => {
    it('posts the input and returns the result', async () => {
      const onBody = vi.fn<(body: unknown) => void>();
      server.use(
        http.post('*/api/tools/weather/execute', async ({ request }) => {
          onBody(await request.json());
          return HttpResponse.json({ temperature: 21 });
        }),
      );
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExecuteTool(), { wrapper });
      let response: unknown;
      await act(async () => {
        response = await result.current.mutateAsync({ toolId: 'weather', input: { city: 'Paris' } });
      });
      expect(response).toEqual({ temperature: 21 });
      expect(onBody).toHaveBeenCalledWith(expect.objectContaining({ data: { city: 'Paris' } }));
    });
  });
});
