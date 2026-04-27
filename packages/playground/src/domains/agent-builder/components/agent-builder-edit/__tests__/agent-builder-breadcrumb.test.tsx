// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderBreadcrumb } from '../agent-builder-breadcrumb';

const FormWrapper = ({
  children,
  defaults,
}: {
  children: React.ReactNode;
  defaults?: Partial<AgentBuilderEditFormValues>;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Support agent',
      instructions: '',
      tools: {},
      skills: [],
      ...defaults,
    },
  });
  return (
    <MemoryRouter>
      <TooltipProvider>
        <FormProvider {...methods}>{children}</FormProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
};

describe('AgentBuilderBreadcrumb', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the form name when not loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb />
      </FormWrapper>,
    );

    expect(screen.getByText('Support agent')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-breadcrumb-skeleton')).toBeNull();
  });

  it('renders a skeleton in place of the current crumb when loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb isLoading />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-breadcrumb-skeleton')).toBeTruthy();
    expect(screen.queryByText('Support agent')).toBeNull();
  });

  it('renders "New agent" as a static label when creating, ignoring the form name', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb creating />
      </FormWrapper>,
    );

    expect(screen.getByText('New agent')).toBeTruthy();
    expect(screen.queryByText('Support agent')).toBeNull();
  });
});
