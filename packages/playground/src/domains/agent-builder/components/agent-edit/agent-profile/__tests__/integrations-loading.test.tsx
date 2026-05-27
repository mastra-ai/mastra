// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Integrations } from '../integrations';

const BASE_URL = 'http://localhost:4111';

vi.mock('@/domains/agent-builder/contexts/edit-page-context', () => ({
  useEditPage: () => ({ canPublishToChannel: false }),
}));

vi.mock('@/domains/agents/hooks/use-channels', () => ({
  useChannelPlatforms: () => ({ data: undefined, isLoading: true }),
  useChannelInstallations: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/domains/agent-builder/hooks/use-publish-and-connect-channel', () => ({
  usePublishAndConnectChannel: () => ({
    requestPublishAndConnect: () => {},
    dialog: null,
    channelDialog: null,
  }),
}));

const Harness = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: 'private' } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>{children}</FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

describe('Integrations loading state', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a structural skeleton that reserves the heading + card footprint', () => {
    const { getByTestId, queryByTestId, container } = render(
      <Harness>
        <Integrations agentId="agent-1" />
      </Harness>,
    );

    const skeleton = getByTestId('integrations-detail-picker-loading');
    expect(skeleton).toBeTruthy();
    // The loaded picker testid must NOT be present while data is loading.
    expect(queryByTestId('integrations-detail-picker')).toBeNull();

    // Lock in that the card footprint is reserved with the same `w-48`
    // width as the real `IntegrationCard`, so the panel doesn't reflow
    // when channel platforms resolve.
    const cardWidthRegex = /(^|\s)w-48(\s|$)/;
    const hasCardSizedChild = Array.from(container.querySelectorAll('*')).some(el => cardWidthRegex.test(el.className));
    expect(hasCardSizedChild).toBe(true);
  });
});
