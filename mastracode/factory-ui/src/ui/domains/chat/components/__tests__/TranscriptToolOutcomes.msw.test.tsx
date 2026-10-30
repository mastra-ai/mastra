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

      const line = screen.getByRole('group', { name: 'Read files, wrote a file' });
      expect(within(line).getByText('1 failed')).toBeVisible();
      await userEvent.click(within(line).getByRole('button'));
      const denied = screen.getByRole('group', { name: 'Tool: write_file' });
      await userEvent.click(within(denied).getByRole('button'));
      expect(within(denied).getByText('Permission denied')).toBeVisible();
    });
  });

  describe('when one call has only a partial result', () => {
    it('keeps the line busy, with no outcome, until the call settles', () => {
      renderWithProviders(
        <MemoryRouter>
          <TranscriptEntries entries={[runningTools]} running onApprove={() => {}} onRespond={() => {}} />
        </MemoryRouter>,
      );

      const line = screen.getByRole('group', { name: 'Reading' });
      expect(line).toHaveAttribute('aria-busy', 'true');
      expect(within(line).queryByText(/failed|incomplete/)).not.toBeInTheDocument();
    });
  });
});
