import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolDrawerContent } from '../tool-drawer/tool-drawer-content';

const renderContent = (canRun: boolean) =>
  render(<ToolDrawerContent overview={<p>Overview body</p>} playground={<p>Playground body</p>} canRun={canRun} />);

describe('ToolDrawerContent', () => {
  describe('when the viewer can execute tools', () => {
    it('enables the Playground tab', () => {
      renderContent(true);

      expect(screen.getByRole('tab', { name: 'Playground' }).getAttribute('aria-disabled')).not.toBe('true');
    });
  });

  describe('when the viewer cannot execute tools', () => {
    it('disables the Playground tab and does not render the runner', () => {
      renderContent(false);

      expect(screen.getByRole('tab', { name: 'Playground' }).getAttribute('aria-disabled')).toBe('true');
      expect(screen.queryByText('Playground body')).toBeNull();
    });
  });
});
