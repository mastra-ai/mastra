import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { EditTopBar } from '../edit-top-bar';

const FormWrapper = ({ children, initialPath = '/' }: { children: React.ReactNode; initialPath?: string }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: 'Support agent', instructions: '', tools: {}, skills: {} },
  });
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <TooltipProvider>
        <FormProvider {...methods}>{children}</FormProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
};

describe('EditTopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a breadcrumb with "Agent list" link and the current agent name', () => {
    render(
      <FormWrapper initialPath="/agent-builder/agents/abc">
        <EditTopBar isLoading={false} />
      </FormWrapper>,
    );

    const link = screen.getByRole('link', { name: /agent list/i });
    expect(link.getAttribute('href')).toBe('/agent-builder/agents');
    expect(screen.getByTestId('agent-builder-back-to-list').getAttribute('href')).toBe('/agent-builder/agents');
    expect(screen.getByText('Support agent')).toBeTruthy();
  });

  it('shows the skeleton placeholder in the current crumb while loading', () => {
    render(
      <FormWrapper>
        <EditTopBar isLoading={true} />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-skeleton')).toBeTruthy();
  });

  it('renders the mode-toggle button when mode is "test" and invokes the callback', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <EditTopBar isLoading={false} mode="test" onModeToggle={onModeToggle} />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle');
    expect(toggle.textContent).toContain('Switch to Edit');
    fireEvent.click(toggle);
    expect(onModeToggle).toHaveBeenCalledTimes(1);
  });

  it('renders no mode toggle when mode is undefined', () => {
    render(
      <FormWrapper>
        <EditTopBar isLoading={false} />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('renders the primaryAction, rightAside and mobileExtra slots', () => {
    render(
      <FormWrapper>
        <EditTopBar
          isLoading={false}
          rightAside={<span data-testid="right-aside">aside</span>}
          primaryAction={<button data-testid="primary-action">Publish</button>}
          mobileExtra={<button data-testid="mobile-extra">Menu</button>}
        />
      </FormWrapper>,
    );

    expect(screen.getByTestId('right-aside')).toBeTruthy();
    expect(screen.getByTestId('primary-action')).toBeTruthy();
    const mobile = screen.getByTestId('mobile-extra');
    expect(mobile.parentElement!.className).toContain('lg:hidden');
  });

  it('disables the toggle when modeToggleDisabled is true', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <EditTopBar isLoading={false} mode="test" onModeToggle={onModeToggle} modeToggleDisabled />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    expect(onModeToggle).not.toHaveBeenCalled();
  });
});
