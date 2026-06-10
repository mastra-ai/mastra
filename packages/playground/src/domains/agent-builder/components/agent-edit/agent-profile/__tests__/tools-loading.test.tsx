// @vitest-environment jsdom
import type { ListToolProvidersResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Tools } from '../tools';

const BASE_URL = 'http://localhost:4111';

const emptyToolProviders: ListToolProvidersResponse = { providers: [] };

const Harness = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      tools: {},
      agents: {},
      workflows: {},
      toolProviders: {},
    } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

describe('Tools loading state', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a skeleton (never the empty state) while provider tools load, then the padded empty state', async () => {
    const gate = (() => {
      let resolve: () => void = () => {};
      const promise = new Promise<void>(r => {
        resolve = r;
      });
      return { promise, resolve };
    })();

    server.use(
      http.get(`${BASE_URL}/api/tool-providers`, async () => {
        await gate.promise;
        return HttpResponse.json(emptyToolProviders);
      }),
    );

    render(
      <Harness>
        <Tools availableAgentTools={[]} />
      </Harness>,
    );

    // While integration tools may still arrive, render the structural skeleton
    // (mirroring the Models loading layout) — never the empty-state flash.
    const skeleton = await screen.findByTestId('tools-card-picker-loading');
    expect(skeleton.className).toContain('grid-cols-[280px_minmax(0,1fr)]');
    expect(screen.queryByText('No tools available in this project')).toBeNull();
    expect(screen.queryByTestId('tools-card-picker')).toBeNull();

    gate.resolve();

    // Once resolved-empty, the empty state appears with the pane padding the
    // two-column layouts use, so it is not flush under the `!py-0` tab shell.
    await waitFor(() => {
      expect(screen.queryByTestId('tools-card-picker-loading')).toBeNull();
    });
    expect(screen.getByText('No tools available in this project')).toBeTruthy();
    expect(screen.getByTestId('tools-empty-state').className).toContain('px-6');
    expect(screen.getByTestId('tools-empty-state').className).toContain('py-6');
  });
});
