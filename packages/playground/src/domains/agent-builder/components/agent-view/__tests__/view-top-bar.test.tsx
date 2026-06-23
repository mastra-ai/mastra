import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { ViewTopBar } from '../view-top-bar';

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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('ViewTopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a breadcrumb with "Agent list" linking to the agents list and the current agent name', () => {
    render(
      <FormWrapper initialPath="/agent-builder/agents/abc">
        <Routes>
          <Route
            path="/agent-builder/agents/:id"
            element={
              <>
                <ViewTopBar />
                <LocationProbe />
              </>
            }
          />
          <Route path="/agent-builder/agents" element={<LocationProbe />} />
        </Routes>
      </FormWrapper>,
    );

    const link = screen.getByRole('link', { name: /agent list/i });
    expect(link.getAttribute('href')).toBe('/agent-builder/agents');
    expect(screen.getByTestId('agent-builder-back-to-list').getAttribute('href')).toBe('/agent-builder/agents');
    expect(screen.getByText('Support agent')).toBeTruthy();

    fireEvent.click(link);
    expect(screen.getByTestId('location').textContent).toBe('/agent-builder/agents');
  });

  it('renders the mode-toggle button when mode is "test" and invokes the callback', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <ViewTopBar mode="test" onModeToggle={onModeToggle} />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-badge-test')).toBeNull();
    const toggle = screen.getByTestId('agent-builder-mode-toggle');
    expect(toggle.textContent).toContain('Switch to Edit');
    fireEvent.click(toggle);
    expect(onModeToggle).toHaveBeenCalledTimes(1);
  });

  it('renders no mode toggle when mode is undefined', () => {
    render(
      <FormWrapper>
        <ViewTopBar />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-badge-test')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mode-badge-build')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('renders owner actions in a desktop-only container', () => {
    render(
      <FormWrapper>
        <ViewTopBar ownerActions={<button data-testid="owner-action">Publish</button>} />
      </FormWrapper>,
    );

    const action = screen.getByTestId('owner-action');
    expect(action).toBeTruthy();
    const wrapper = action.parentElement!;
    expect(wrapper.className).toContain('hidden');
    expect(wrapper.className).toContain('lg:flex');
  });

  it('renders the mobile menu in a mobile-only container', () => {
    render(
      <FormWrapper>
        <ViewTopBar mobileMenu={<button data-testid="mobile-menu">Menu</button>} />
      </FormWrapper>,
    );

    const menu = screen.getByTestId('mobile-menu');
    const wrapper = menu.parentElement!;
    expect(wrapper.className).toContain('lg:hidden');
  });

  it('disables the toggle when modeToggleDisabled is true', () => {
    const onModeToggle = vi.fn();
    render(
      <FormWrapper>
        <ViewTopBar mode="test" onModeToggle={onModeToggle} modeToggleDisabled />
      </FormWrapper>,
    );

    const toggle = screen.getByTestId('agent-builder-mode-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    expect(onModeToggle).not.toHaveBeenCalled();
  });
});
