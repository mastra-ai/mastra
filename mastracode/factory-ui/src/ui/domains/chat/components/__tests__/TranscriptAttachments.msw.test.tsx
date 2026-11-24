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

      const attachments = screen.getByRole('group', { name: 'Sent attachments' });
      expect(attachments.closest('[data-slot="message"]')?.querySelector('[data-slot="message-content"]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /^Preview / }));

      expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', source);
    });
  });
  it('places named files and legacy text attachments above the message bubble', () => {
    const entry: TimelineEntry = {
      kind: 'message',
      id: 'files-message',
      message: {
        id: 'files-message',
        role: 'user',
        createdAt: new Date('2026-09-16T10:00:00Z'),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Please review these files.' },
            { type: 'file', mimeType: 'application/pdf', data: 'https://example.com/proposal.pdf' },
            {
              type: 'file',
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              data: 'https://example.com/revenue.xlsx',
            },
            { type: 'text', text: '<attachment name="notes.txt">Original notes</attachment>' },
          ],
        },
      },
    };
    renderWithProviders(<TranscriptEntries entries={[entry]} onApprove={() => {}} onRespond={() => {}} />);
    const attachments = screen.getByRole('group', { name: 'Sent attachments' });
    const bubble = screen.getByText('Please review these files.').closest('[data-slot="message-content"]');
    expect(bubble).not.toBeNull();
    if (!bubble) throw new Error('Expected a text bubble');
    expect(bubble.contains(attachments)).toBe(false);
    expect(attachments.compareDocumentPosition(bubble)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(attachments).getByRole('button', { name: 'Preview proposal.pdf' })).toBeTruthy();
    expect(within(attachments).getByRole('link', { name: 'Open revenue.xlsx' })).toBeTruthy();
    fireEvent.click(within(attachments).getByRole('button', { name: 'Preview notes.txt' }));
    expect(within(screen.getByRole('dialog')).getByText('Original notes')).toBeTruthy();
  });
});
