// @vitest-environment jsdom
import { DropdownMenu, TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { VisibilityMenuItem } from '../visibility-menu-item';

const BASE_URL = 'http://localhost:4111';

const requestChangeMock = vi.fn();
vi.mock('../../../hooks/use-visibility-change-agent', () => ({
  useVisibilityChange: () => ({
    requestChange: requestChangeMock,
    dialog: null,
  }),
}));

interface HarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  disabled?: boolean;
}

const Harness = ({ defaultVisibility = 'private', disabled = false }: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>
              <DropdownMenu defaultOpen>
                <DropdownMenu.Trigger>open</DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <VisibilityMenuItem agentId="agent-1" disabled={disabled} />
                </DropdownMenu.Content>
              </DropdownMenu>
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('VisibilityMenuItem', () => {
  afterEach(() => {
    cleanup();
    requestChangeMock.mockReset();
  });

  it('renders the Add to library action when the form visibility is private', () => {
    render(<Harness defaultVisibility="private" />);

    const add = screen.getByTestId('agent-builder-mobile-menu-visibility-add');
    expect(add.textContent).toContain('Add to library');
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-remove')).toBeNull();
  });

  it('renders the Remove from library action when the form visibility is public', () => {
    render(<Harness defaultVisibility="public" />);

    const remove = screen.getByTestId('agent-builder-mobile-menu-visibility-remove');
    expect(remove.textContent).toContain('Remove from library');
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-add')).toBeNull();
  });

  it('calls requestChange("public") when the Add action is selected', () => {
    render(<Harness defaultVisibility="private" />);

    act(() => {
      fireEvent.click(screen.getByTestId('agent-builder-mobile-menu-visibility-add'));
    });

    expect(requestChangeMock).toHaveBeenCalledTimes(1);
    expect(requestChangeMock).toHaveBeenCalledWith('public');
  });

  it('calls requestChange("private") when the Remove action is selected', () => {
    render(<Harness defaultVisibility="public" />);

    act(() => {
      fireEvent.click(screen.getByTestId('agent-builder-mobile-menu-visibility-remove'));
    });

    expect(requestChangeMock).toHaveBeenCalledTimes(1);
    expect(requestChangeMock).toHaveBeenCalledWith('private');
  });

  it('marks the menu item as disabled when the disabled flag is true', () => {
    render(<Harness defaultVisibility="private" disabled />);

    const item = screen.getByTestId('agent-builder-mobile-menu-visibility-add');
    expect(item.hasAttribute('data-disabled')).toBe(true);
  });
});
