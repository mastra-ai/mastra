// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Models } from '../models';
import { buildBuilderSettings } from './fixtures/builder';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const FormHarness = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      model: { provider: '', name: '' },
    } as AgentBuilderEditFormValues,
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>
          <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
        </FormProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('Models loading state', () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())),
      // Never resolves, so the available-models query stays pending and the
      // picker renders its loading skeleton.
      http.get(`${BASE_URL}/api/editor/builder/models/available`, async () => {
        await delay('infinite');
        return HttpResponse.json({ providers: [] });
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe('when the available-models query is pending', () => {
    it('renders the loading skeleton instead of the loaded picker', () => {
      const { getByTestId, queryByTestId } = render(
        <FormHarness>
          <Models />
        </FormHarness>,
      );

      expect(getByTestId('model-card-picker-loading')).toBeTruthy();
      expect(queryByTestId('model-card-picker')).toBeNull();
    });

    it('mirrors the loaded grid template so the structural contract cannot regress', () => {
      const { getByTestId } = render(
        <FormHarness>
          <Models />
        </FormHarness>,
      );

      const skeleton = getByTestId('model-card-picker-loading');
      expect(skeleton.className).toContain('grid-cols-[280px_minmax(0,1fr)]');
    });
  });
});
