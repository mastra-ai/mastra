// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionRow } from './index';

afterEach(cleanup);

describe('ActionRow', () => {
  describe('when start and end groups are provided', () => {
    it('pushes them apart with justify-between and marks each group', () => {
      render(
        <ActionRow>
          <ActionRow.Start>
            <span>start</span>
          </ActionRow.Start>
          <ActionRow.End>
            <span>end</span>
          </ActionRow.End>
        </ActionRow>,
      );

      const row = screen.getByText('start').closest('[data-slot="action-row"]');
      expect(row?.className).toContain('justify-between');
      expect(screen.getByText('start').parentElement?.dataset.slot).toBe('action-row-start');
      expect(screen.getByText('end').parentElement?.dataset.slot).toBe('action-row-end');
    });
  });

  describe('when only an end group is provided', () => {
    it('still sits on the right', () => {
      render(
        <ActionRow>
          <ActionRow.End>
            <button>Only</button>
          </ActionRow.End>
        </ActionRow>,
      );

      const end = screen.getByRole('button', { name: 'Only' }).parentElement;
      expect(end?.className).toContain('ml-auto');
    });
  });
});
