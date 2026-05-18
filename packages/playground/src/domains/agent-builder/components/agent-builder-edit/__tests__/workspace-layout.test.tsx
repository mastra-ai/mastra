// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
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

const renderLayout = (props?: { configure?: ReactNode | null }) =>
  render(
    <Wrapper>
      <WorkspaceLayout
        isLoading={false}
        mode="build"
        chat={<div data-testid="stub-chat">chat</div>}
        configure={
          props && 'configure' in props
            ? (props.configure ?? undefined)
            : <div data-testid="stub-configure">configure</div>
        }
      />
    </Wrapper>,
  );

describe('WorkspaceLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders chat and configure side-by-side in a 50/50 desktop grid', () => {
    const { container, getByTestId } = renderLayout();
    const root = container.firstChild as HTMLElement;
    // Root uses the plain Tailwind 50/50 two-column grid at lg+.
    expect(root.className).toContain('lg:grid');
    expect(root.className).toContain('lg:grid-cols-2');

    // Both panels are rendered.
    expect(getByTestId('agent-builder-panel-chat')).toBeTruthy();
    expect(getByTestId('agent-builder-panel-configure')).toBeTruthy();
  });

  it('renders the configure panel as a sibling of the main column (not nested inside the chat panel)', () => {
    const { container, getByTestId } = renderLayout();
    const root = container.firstChild as HTMLElement;
    const chatPanel = getByTestId('agent-builder-panel-chat');
    const configurePanel = getByTestId('agent-builder-panel-configure');

    // Configure panel must be a direct child of the workspace root.
    expect(configurePanel.parentElement).toBe(root);

    // Chat panel must NOT live inside the configure panel.
    expect(configurePanel.contains(chatPanel)).toBe(false);

    // Chat panel must NOT be a direct child of the workspace root; it's nested
    // inside the main column wrapper.
    expect(chatPanel.parentElement).not.toBe(root);
  });

  it('does not render a Show/Hide configuration toggle button', () => {
    const { queryByLabelText } = renderLayout();
    expect(queryByLabelText('Show configuration')).toBeNull();
    expect(queryByLabelText('Hide configuration')).toBeNull();
  });

  it('does not render Chat/Configuration tab buttons', () => {
    const { queryByTestId } = renderLayout();
    expect(queryByTestId('agent-builder-tab-chat')).toBeNull();
    expect(queryByTestId('agent-builder-tab-configure')).toBeNull();
  });

  it('does not render the configure sibling when no configure slot is provided', () => {
    const { queryByTestId } = renderLayout({ configure: null });
    expect(queryByTestId('agent-builder-panel-configure')).toBeNull();
  });
});
