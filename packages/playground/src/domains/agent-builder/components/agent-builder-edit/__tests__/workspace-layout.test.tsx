// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { WorkspaceLayout } from '../workspace-layout';

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Support agent',
      instructions: '',
      tools: {},
      skills: {},
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

const renderLayout = (props?: { defaultExpanded?: boolean; detailOpen?: boolean; showConfigure?: boolean }) =>
  render(
    <Wrapper>
      <WorkspaceLayout
        isLoading={false}
        mode="build"
        defaultExpanded={props?.defaultExpanded ?? true}
        detailOpen={props?.detailOpen ?? false}
        showConfigure={props?.showConfigure ?? true}
        chat={<div data-testid="stub-chat">chat</div>}
        configure={<div data-testid="stub-configure">configure</div>}
      />
    </Wrapper>,
  );

describe('WorkspaceLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the workspace grid wrapper that drives the desktop push transition', () => {
    const { container } = renderLayout();
    const root = container.querySelector('.agent-builder-workspace-grid');
    expect(root).not.toBeNull();
    // Expanded + no detail open => 320px configure column
    expect(root?.className).toContain('lg:grid-cols-[1fr_320px]');
  });

  it('uses the wider grid template when a detail pane is open', () => {
    const { container } = renderLayout({ defaultExpanded: true, detailOpen: true });
    const root = container.querySelector('.agent-builder-workspace-grid');
    expect(root?.className).toContain('lg:grid-cols-[1fr_calc(50%-12px)]');
  });

  it('collapses the configure column when not expanded', () => {
    const { container, getByTestId } = renderLayout({ defaultExpanded: false });
    const root = container.querySelector('.agent-builder-workspace-grid');
    expect(root?.className).toContain('lg:grid-cols-[1fr_0px]');

    const configurePanel = getByTestId('agent-builder-panel-configure');
    expect(configurePanel.getAttribute('aria-hidden')).toBe('true');
  });

  it('toggles the configure sibling visibility via the Show/Hide configuration button', () => {
    const { getByLabelText, getByTestId } = renderLayout({ defaultExpanded: false });
    const configurePanel = getByTestId('agent-builder-panel-configure');
    expect(configurePanel.getAttribute('aria-hidden')).toBe('true');

    const toggle = getByLabelText('Show configuration');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);

    expect(configurePanel.getAttribute('aria-hidden')).toBe('false');
    expect(getByLabelText('Hide configuration').getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the configure panel as a sibling of the main column (not nested inside the chat panel)', () => {
    const { container, getByTestId } = renderLayout();
    const root = container.querySelector('.agent-builder-workspace-grid') as HTMLElement;
    const chatPanel = getByTestId('agent-builder-panel-chat');
    const configurePanel = getByTestId('agent-builder-panel-configure');

    // Configure panel must be a direct child of the workspace grid root.
    expect(configurePanel.parentElement).toBe(root);

    // Chat panel must NOT live inside the configure panel.
    expect(configurePanel.contains(chatPanel)).toBe(false);

    // Chat panel must NOT be a direct child of the workspace grid; it's nested
    // inside the main column wrapper.
    expect(chatPanel.parentElement).not.toBe(root);
  });

  it('does not render the desktop configure sibling when showConfigure is false', () => {
    const { queryByTestId } = renderLayout({ showConfigure: false });
    expect(queryByTestId('agent-builder-panel-configure')).toBeNull();
  });
});
