// @vitest-environment jsdom
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';

const renderWithToggle = (onToggle: () => void) => {
  render(
    <KeyboardShortcutsProvider>
      <OverviewPanelShortcuts onToggle={onToggle} />
      <textarea data-testid="composer" />
    </KeyboardShortcutsProvider>,
  );
};

afterEach(() => cleanup());

describe('OverviewPanelShortcuts', () => {
  describe('when chat configuration is available', () => {
    it('pressing ] toggles the overview panel', () => {
      const onToggle = vi.fn();
      renderWithToggle(onToggle);

      fireEvent.keyDown(window, { key: ']' });

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('] typed inside a textarea is ignored', () => {
      const onToggle = vi.fn();
      renderWithToggle(onToggle);

      fireEvent.keyDown(screen.getByTestId('composer'), { key: ']' });

      expect(onToggle).not.toHaveBeenCalled();
    });

    it('[ does not toggle the overview panel', () => {
      const onToggle = vi.fn();
      renderWithToggle(onToggle);

      fireEvent.keyDown(window, { key: '[' });

      expect(onToggle).not.toHaveBeenCalled();
    });
  });
});
