import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { TranscriptEntries } from '../Transcript';
import type { TimelineEntry } from '../../services/transcript';

function errorNotice(id: string, text: string): TimelineEntry {
  return { kind: 'notice', id: `session-error-${id}`, level: 'error', text };
}

describe('persisted session-error notices', () => {
  it('retains one live occurrence through a history refresh and keeps a second identical failure distinct', () => {
    const live = errorNotice('first', 'The provider failed.');
    const history = errorNotice('first', 'The provider failed.');
    const second = errorNotice('second', 'The provider failed.');
    const { rerender } = renderWithProviders(
      <TranscriptEntries entries={[live]} onApprove={() => {}} onRespond={() => {}} />,
    );

    rerender(<TranscriptEntries entries={[history]} onApprove={() => {}} onRespond={() => {}} />);
    expect(screen.getAllByText('The provider failed.')).toHaveLength(1);

    rerender(<TranscriptEntries entries={[history, second]} onApprove={() => {}} onRespond={() => {}} />);
    expect(screen.getAllByText('The provider failed.')).toHaveLength(2);
  });
});
