import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { LLMModels } from '../components/llm-models';
import { datedModels } from './fixtures/models';
import { buildBuilderSettings } from '@/domains/agent-builder/hooks/__tests__/fixtures/builder-settings';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(cleanup);

describe('LLMModels', () => {
  describe('when the catalog contains release dates and custom models', () => {
    it('offers newer models first and keeps custom models selectable', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json(datedModels)),
        http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(datedModels)),
        http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())),
      );
      const selected: string[] = [];
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <LLMModels llmId="openai" value="gpt-4o" onValueChange={value => selected.push(value)} />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      fireEvent.click(await screen.findByRole('combobox'));
      const options = await screen.findAllByRole('option');
      expect(options.map(option => option.textContent)).toEqual(['gpt-5', 'gpt-4.1', 'gpt-4o', 'custom-a', 'custom-z']);
      const custom = screen.getByRole('option', { name: 'custom-z' });
      fireEvent.pointerDown(custom, { pointerType: 'mouse' });
      fireEvent.click(custom, { detail: 1 });
      expect(selected).toEqual(['custom-z']);
    });
  });
});
