// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderMobileMenu } from '../agent-builder-mobile-menu';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  onDirtyChange?: (isDirty: boolean) => void;
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', onDirtyChange, children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const isDirty = methods.formState.isDirty;
  onDirtyChange?.(isDirty);
  return (
    <MemoryRouter>
      <TooltipProvider>
        <FormProvider {...methods}>
          {children}
          <span data-testid="form-visibility">{value}</span>
          <span data-testid="form-dirty">{isDirty ? 'true' : 'false'}</span>
        </FormProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
};

const openDropdown = async () => {
  const trigger = screen.getByTestId('agent-builder-mobile-menu-trigger');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await screen.findByRole('menu');
};

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

describe('AgentBuilderMobileMenu', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no items are configured', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility={false} showPublishToSlack={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });

  it('wraps the trigger in an lg:hidden container so desktop never sees it', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility showPublishToSlack />
      </FormHarness>,
    );

    const wrapper = screen.getByTestId('agent-builder-mobile-menu');
    expect(wrapper.className).toContain('lg:hidden');
  });

  it('shows both items in edit mode', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility showPublishToSlack />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility')).toBeTruthy();
    expect(screen.getByTestId('agent-builder-mobile-menu-publish-slack')).toBeTruthy();
  });

  it('shows only Publish in view-mode shape and never renders the visibility dialog', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility={false} showPublishToSlack />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility')).toBeNull();
    expect(screen.getByTestId('agent-builder-mobile-menu-publish-slack')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-visibility-dialog')).toBeNull();
  });

  it('opens the visibility dialog, writes Public into the form (dirties it), and closes on Done', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility showPublishToSlack />
      </FormHarness>,
    );

    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');

    await openDropdown();
    fireEvent.click(screen.getByTestId('agent-builder-mobile-menu-visibility'));

    const publicOption = await screen.findByTestId('agent-builder-visibility-dialog-option-public');
    fireEvent.click(publicOption);

    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    expect(screen.getByTestId('form-dirty').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('agent-builder-visibility-dialog-done'));

    expect(screen.queryByTestId('agent-builder-visibility-dialog')).toBeNull();
  });

  it('disables menu items when disabled is true', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility showPublishToSlack disabled />
      </FormHarness>,
    );

    await openDropdown();

    const visibilityItem = screen.getByTestId('agent-builder-mobile-menu-visibility');
    const publishItem = screen.getByTestId('agent-builder-mobile-menu-publish-slack');

    expect(visibilityItem.getAttribute('data-disabled')).not.toBeNull();
    expect(publishItem.getAttribute('data-disabled')).not.toBeNull();
  });
});
