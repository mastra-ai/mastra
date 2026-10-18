import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { TranscriptEntries } from '../Transcript';
import { runningTools, settledTools } from './fixtures/tool-outcomes';

describe('Transcript tool outcomes', () => {
  describe('when persisted calls have settled', () => {
    it('counts empty and false results as successful and keeps denied calls failed', async () => {
      renderWithProviders(
        <MemoryRouter>
          <TranscriptEntries entries={[settledTools]} onApprove={() => {}} onRespond={() => {}} />
        </MemoryRouter>,
      );

      const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
      expect(within(group).getByText('2 OK · 1 failed')).toBeVisible();
      await userEvent.click(within(group).getByRole('button'));
      const denied = screen.getByRole('group', { name: 'Tool: write_file' });
      await userEvent.click(within(denied).getByRole('button'));
      expect(within(denied).getByText('Permission denied')).toBeVisible();
    });
  });

  describe('when one call has only a partial result', () => {
    it('keeps showing progress until the call settles', () => {
      renderWithProviders(
        <MemoryRouter>
          <TranscriptEntries entries={[runningTools]} onApprove={() => {}} onRespond={() => {}} />
        </MemoryRouter>,
      );

      const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
      expect(group).toHaveAttribute('aria-busy', 'true');
      expect(within(group).getByText('2/3')).toBeVisible();
      expect(within(group).queryByText(/OK/)).not.toBeInTheDocument();
    });
  });
});
