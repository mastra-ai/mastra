// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
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
          props && 'configure' in props ? (
            (props.configure ?? undefined)
          ) : (
            <div data-testid="stub-configure">configure</div>
          )
        }
      />
    </Wrapper>,
  );

describe('WorkspaceLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders chat and configure side-by-side in a 50/50 desktop grid below the header', () => {
    const { getByTestId } = renderLayout();
    const chatPanel = getByTestId('agent-builder-panel-chat');
    const configurePanel = getByTestId('agent-builder-panel-configure');

    // Walk up from chat to find the row container that holds both panels; it
    // must also contain the configure panel (i.e. chat and configure share an
    // ancestor that is NOT the page root).
    let row: HTMLElement | null = chatPanel.parentElement;
    while (row && !row.contains(configurePanel)) {
      row = row.parentElement;
    }
    expect(row).not.toBeNull();
    // That shared row uses the plain Tailwind 50/50 two-column grid at lg+.
    expect(row!.className).toContain('lg:grid');
    expect(row!.className).toContain('lg:grid-cols-2');
  });

  it('renders the configure panel as a sibling of the chat column, not at the page root', () => {
    const { container, getByTestId } = renderLayout();
    const root = container.firstChild as HTMLElement;
    const chatPanel = getByTestId('agent-builder-panel-chat');
    const configurePanel = getByTestId('agent-builder-panel-configure');

    // The configure panel must NOT span the full page (i.e. it is not a direct
    // child of the workspace root, which also contains the header).
    expect(configurePanel.parentElement).not.toBe(root);

    // Chat and configure must share the same immediate parent — they sit
    // side-by-side in the same row container below the header.
    expect(configurePanel.parentElement).toBe(chatPanel.parentElement!.parentElement);

    // Chat panel must NOT live inside the configure panel.
    expect(configurePanel.contains(chatPanel)).toBe(false);
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
