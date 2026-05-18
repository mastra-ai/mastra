// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('renders no mode-toggle button when onModeToggle is omitted', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="build" />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('renders no mode-toggle button when mode is undefined, even with onModeToggle', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle onModeToggle={vi.fn()} />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('renders a "Switch to View mode" toggle next to the badge in build mode and invokes the callback on click', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="build" onModeToggle={onModeToggle} />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle') as HTMLButtonElement;
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to View mode');
    expect(toggle.className).toContain('rounded-full');

    fireEvent.click(toggle);
    expect(onModeToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a "Switch to Edit mode" toggle in test mode', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="test" onModeToggle={onModeToggle} />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to Edit mode');
  });

  it('disables the toggle and does not invoke onModeToggle when disabled is true', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <AgentBuilderTitle mode="test" onModeToggle={onModeToggle} disabled />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    expect(onModeToggle).not.toHaveBeenCalled();
  });
});
