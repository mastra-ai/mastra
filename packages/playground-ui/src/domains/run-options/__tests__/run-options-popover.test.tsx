// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunOptionsPopover } from '../components/run-options-popover';
import type { RunOptionsPopoverProps } from '../components/run-options-popover';
import { useRunOptionsDraft } from '../context/run-options-draft';
import { RequestContextProvider } from '@/domains/request-context/context/request-context-provider';
import { TooltipProvider } from '@/ds/components/Tooltip';

const renderPopover = (props: Partial<RunOptionsPopoverProps> = {}) =>
  render(
    <TooltipProvider>
      <RequestContextProvider entityKey="tool:my-tool">
        <RunOptionsPopover triggerVariant="icon" testId="run-options-trigger" {...props} />
      </RequestContextProvider>
    </TooltipProvider>,
  );

describe('RunOptionsPopover', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when the trigger is clicked', () => {
    it('opens and renders the request context editor', async () => {
      renderPopover();

      fireEvent.click(screen.getByTestId('run-options-trigger'));

      expect(await screen.findByText('Run options', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
    }, 15_000);
  });

  describe('when children are provided', () => {
    it('renders them next to the request context editor', async () => {
      renderPopover({ children: <div data-testid="extra-section">tracing</div> });

      fireEvent.click(screen.getByTestId('run-options-trigger'));

      expect(await screen.findByTestId('extra-section', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
    }, 15_000);
  });

  describe('when the popover is rendered inside an outer form', () => {
    it('does not bubble an inner form submit to the outer form', async () => {
      const onOuterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

      render(
        <TooltipProvider>
          <form onSubmit={onOuterSubmit}>
            <RequestContextProvider entityKey="workflow:my-wf">
              <RunOptionsPopover
                triggerVariant="icon"
                testId="run-options-trigger"
                requestContextFormSlot={
                  <form data-testid="inner-form" onSubmit={event => event.preventDefault()}>
                    <button type="submit">Save</button>
                  </form>
                }
              />
            </RequestContextProvider>
          </form>
        </TooltipProvider>,
      );

      fireEvent.click(screen.getByTestId('run-options-trigger'));
      fireEvent.submit(await screen.findByTestId('inner-form', undefined, { timeout: 10_000 }));

      expect(onOuterSubmit).not.toHaveBeenCalled();
    }, 15_000);
  });

  describe('when several sections have pending changes', () => {
    it('saves all of them with the single Save button', async () => {
      const onChildSave = vi.fn();

      const ChildSection = () => {
        const [dirty, setDirty] = useState(false);
        useRunOptionsDraft({
          isDirty: dirty,
          save: () => {
            onChildSave();
            setDirty(false);
            return true;
          },
        });
        return (
          <button type="button" onClick={() => setDirty(true)}>
            Edit child
          </button>
        );
      };

      renderPopover({ children: <ChildSection /> });

      fireEvent.click(screen.getByTestId('run-options-trigger'));
      const saveButton = (await screen.findByRole(
        'button',
        { name: 'Save' },
        { timeout: 10_000 },
      )) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Edit child' }));
      await waitFor(() => expect(saveButton.disabled).toBe(false));

      fireEvent.click(saveButton);

      expect(onChildSave).toHaveBeenCalledTimes(1);
    }, 15_000);
  });

  describe('when the labelled trigger variant is used', () => {
    it('renders a text button with the shortcut hint in its tooltip', () => {
      renderPopover({ triggerVariant: 'labelled', shortcutHint: <kbd>U</kbd> });

      expect(screen.getByRole('button', { name: 'Run options' })).not.toBeNull();
    });
  });
});
