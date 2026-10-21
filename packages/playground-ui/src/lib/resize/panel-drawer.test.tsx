// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PanelDrawer } from './panel-drawer';

afterEach(() => {
  cleanup();
});

describe('PanelDrawer', () => {
  describe('when uncontrolled', () => {
    it('draws its own edge trigger, named by the label', () => {
      render(
        <PanelDrawer direction="right" label="Open details panel">
          Panel content
        </PanelDrawer>,
      );

      expect(screen.getByRole('button', { name: 'Open details panel' })).toBeTruthy();
    });
  });

  describe('when controlled', () => {
    it('draws no edge trigger, so it never covers the page header', () => {
      render(
        <PanelDrawer direction="right" label="Open details panel" open={false}>
          Panel content
        </PanelDrawer>,
      );

      expect(screen.queryByRole('button', { name: 'Open details panel' })).toBeNull();
    });

    it('shows the children when open', async () => {
      render(
        <PanelDrawer direction="right" label="Open details panel" open>
          Panel content
        </PanelDrawer>,
      );

      expect((await screen.findByRole('dialog')).textContent).toContain('Panel content');
    });
  });
});
