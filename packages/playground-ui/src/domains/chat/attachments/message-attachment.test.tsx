// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MessageAttachment } from './message-attachment';
import { splitMessageAttachments } from './split-message-attachments';

afterEach(cleanup);

describe('sent attachment previews', () => {
  it('normalizes a persisted base64 PDF into a browser preview without exposing its payload', () => {
    const { container } = render(
      <MessageAttachment type="document" contentType="application/pdf" name="proposal.pdf" data="JVBERi0xLjQ=" />,
    );
    expect(container.textContent).not.toContain('JVBERi0xLjQ=');
    fireEvent.click(screen.getByRole('button', { name: 'Preview proposal.pdf' }));
    expect(screen.getByRole('link', { name: 'Download PDF' }).getAttribute('download')).toBe('proposal.pdf');
    expect(within(screen.getByRole('dialog')).getByTitle('proposal.pdf').getAttribute('src')).toBe(
      'data:application/pdf;base64,JVBERi0xLjQ=',
    );
  });

  it('keeps a failed image identifiable and lets the user open its original remote source', () => {
    render(
      <MessageAttachment
        type="image"
        contentType="image/png"
        name="diagram.png"
        src="https://example.com/diagram.png"
      />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('PNG · Preview unavailable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open diagram.png' }).getAttribute('href')).toBe(
      'https://example.com/diagram.png',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a readable spreadsheet name without exposing signed URL parameters', () => {
    render(
      <MessageAttachment
        type="file"
        contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        src="https://example.com/files/Revenue%20Q4.xlsx?token=private"
      />,
    );
    expect(screen.getByText('Revenue Q4.xlsx')).toBeTruthy();
    expect(screen.getByText('XLSX')).toBeTruthy();
    expect(screen.getByRole('link').textContent).not.toContain('private');
  });

  it('moves only complete legacy attachment envelopes and keeps text and file order', () => {
    const before = { type: 'text', text: 'The tag <attachment name="notes.txt"> is part of my question.' };
    const legacy = { type: 'text', text: '<attachment name="notes.txt">Original notes</attachment>' };
    const file = { type: 'file', mimeType: 'application/pdf', data: 'JVBERi0xLjQ=' };
    const after = { type: 'text', text: 'Please review.' };
    expect(splitMessageAttachments([before, legacy, file, after])).toEqual({
      attachments: [legacy, file],
      content: [before, after],
    });
  });
});
