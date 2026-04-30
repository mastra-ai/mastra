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

  it('renders the form name when not loading in both mobile and desktop variants', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb />
      </FormWrapper>,
    );

    expect(screen.getAllByText('Support agent')).toHaveLength(2);
    expect(screen.queryByTestId('agent-builder-breadcrumb-skeleton')).toBeNull();
    expect(screen.queryByTestId('agent-builder-breadcrumb-mobile-skeleton')).toBeNull();
  });

  it('renders skeletons in place of the name in both mobile and desktop variants when loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb isLoading />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-breadcrumb-skeleton')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-breadcrumb-mobile-skeleton')).toBeTruthy();
    expect(screen.queryByText('Support agent')).toBeNull();
  });

  it('hides the mobile name on desktop and hides the full breadcrumb on mobile via responsive classes', () => {
    render(
      <FormWrapper>
        <AgentBuilderBreadcrumb mode="build" />
      </FormWrapper>,
    );

    const mobile = screen.getByTestId('agent-builder-breadcrumb-mobile');
    const desktop = screen.getByTestId('agent-builder-breadcrumb-desktop');
    expect(mobile.className).toContain('lg:hidden');
    expect(desktop.className).toContain('hidden');
    expect(desktop.className).toContain('lg:block');
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
    expect(label.textContent).toBe('Edit agent capabilities');
    expect(label.className).toContain('font-semibold');
    expect(crumb.className).not.toContain('text-test');
  });
});
