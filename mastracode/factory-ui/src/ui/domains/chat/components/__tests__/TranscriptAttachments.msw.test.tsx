import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

describe('transcript attachments', () => {
  describe('when an image is sent or restored', () => {
    it.each([
      ['raw base64', 'aGVsbG8=', 'data:image/png;base64,aGVsbG8='],
      ['data URL', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,aGVsbG8='],
      ['remote URL', 'https://example.com/diagram.png', 'https://example.com/diagram.png'],
    ])('opens the original %s image in a preview', (_kind, data, source) => {
      const entry: TimelineEntry = {
        kind: 'message',
        id: 'image-message',
        message: {
          id: 'image-message',
          role: 'user',
          createdAt: new Date('2026-09-16T10:00:00Z'),
          content: { format: 2, parts: [{ type: 'file', mimeType: 'image/png', data }] },
        },
      };
      renderWithProviders(<TranscriptEntries entries={[entry]} onApprove={() => {}} onRespond={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: /^Preview / }));

      expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', source);
    });
  });
});
