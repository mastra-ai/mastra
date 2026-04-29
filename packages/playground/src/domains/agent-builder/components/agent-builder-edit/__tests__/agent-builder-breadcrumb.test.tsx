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

  it('renders "New agent" as a standalone title when creating, with no breadcrumb trail', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb creating />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-create-title').textContent).toBe('New agent');
    expect(screen.queryByText('Agents')).toBeNull();
    expect(screen.queryByText('Support agent')).toBeNull();
  });

  it('renders chat mode with icon and label without mode color styling', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb mode="test" />
      </FormWrapper>,
    );

    const crumb = screen.getByTestId('agent-builder-mode-crumb');
    const label = screen.getByTestId('agent-builder-mode-label');
    expect(screen.getByTestId('agent-builder-mode-icon-test')).toBeTruthy();
    expect(label.textContent).toBe('Chat');
    expect(label.className).toContain('font-semibold');
    expect(crumb.className).not.toContain('text-accent1');
  });

  it('renders edit configuration mode with icon and label without mode color styling', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb mode="build" />
      </FormWrapper>,
    );

    const crumb = screen.getByTestId('agent-builder-mode-crumb');
    const label = screen.getByTestId('agent-builder-mode-label');
    expect(screen.getByTestId('agent-builder-mode-icon-build')).toBeTruthy();
    expect(label.textContent).toBe('Edit configuration');
    expect(label.className).toContain('font-semibold');
    expect(crumb.className).not.toContain('text-test');
  });
});
