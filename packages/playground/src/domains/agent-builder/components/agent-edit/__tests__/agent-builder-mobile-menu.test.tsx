// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderMobileMenu } from '../agent-builder-mobile-menu';

const BASE_URL = 'http://localhost:4111';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>
              {children}
              <span data-testid="form-visibility">{value}</span>
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('AgentBuilderMobileMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no items are configured', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });

  it('wraps the trigger in an lg:hidden container so desktop never sees it', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    const wrapper = screen.getByTestId('agent-builder-mobile-menu');
    expect(wrapper.className).toContain('lg:hidden');
  });

  it('renders nothing when showSetVisibility is false and no other actions are enabled', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });
});
