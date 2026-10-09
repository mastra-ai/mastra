// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useLLMProviders } from '../use-llm-providers';

const providers: Awaited<ReturnType<MastraClient['listAgentsModelProviders']>> = {
  providers: [{ id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o'] }],
};

afterEach(() => cleanup());

describe('useLLMProviders', () => {
  describe('when the server lists model providers', () => {
    it('returns the providers', async () => {
      server.use(http.get('*/api/agents/providers', () => HttpResponse.json(providers)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useLLMProviders(), { wrapper });
      await waitFor(() => expect(result.current.data?.providers.map(p => p.id)).toEqual(['openai']));
    });
  });
});
