// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderTitle } from '../agent-builder-title';

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
      skills: {},
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

describe('AgentBuilderTitle', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the form name when not loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="build" />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-name').textContent).toBe('Support agent');
    expect(screen.queryByTestId('agent-builder-title-skeleton')).toBeNull();
  });

  it('renders a skeleton in place of the name when loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle isLoading mode="build" />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-skeleton')).toBeTruthy();
    expect(screen.queryByText('Support agent')).toBeNull();
  });

  it('renders an "Edit mode" badge when mode is build', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="build" />
      </FormWrapper>,
    );

    const badge = screen.getByTestId('agent-builder-mode-badge-build');
    expect(badge.textContent).toBe('Edit mode');
    expect(screen.queryByTestId('agent-builder-mode-badge-test')).toBeNull();
  });

  it('renders a "View mode" badge when mode is test', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="test" />
      </FormWrapper>,
    );

    const badge = screen.getByTestId('agent-builder-mode-badge-test');
    expect(badge.textContent).toBe('View mode');
    expect(screen.queryByTestId('agent-builder-mode-badge-build')).toBeNull();
  });

  it('renders no mode badge when mode is undefined', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-badge-build')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mode-badge-test')).toBeNull();
  });

  it('renders "New agent" as a standalone title when creating, with no badge', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle creating mode="build" />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-create-title').textContent).toBe('New agent');
    expect(screen.queryByTestId('agent-builder-mode-badge-build')).toBeNull();
    expect(screen.queryByText('Support agent')).toBeNull();
  });
});
