import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ComposerAttachments } from '../attachment';
import { ComposerAttachmentsProvider } from '../composer-attachments';
import { ComposerFileDrop } from '../composer-file-drop';

// The OS drag-and-drop is the only browser boundary; the real provider validates the files.
const dropOnWindow = (files: File[]) => {
  for (const type of ['dragenter', 'drop']) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
    act(() => {
      fireEvent(window, event);
    });
  }
};

const renderComposer = (disabled = false) =>
  render(
    <ComposerAttachmentsProvider>
      <ComposerFileDrop disabled={disabled}>
        <ComposerAttachments />
      </ComposerFileDrop>
    </ComposerAttachmentsProvider>,
  );

describe('ComposerFileDrop', () => {
  describe('when a file is dragged over the page', () => {
    it('covers the page with a drop backdrop', () => {
      renderComposer();
      const event = new Event('dragenter', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files: [] } });
      act(() => {
        fireEvent(window, event);
      });
      expect(screen.getByRole('status').textContent).toContain('Drop to attach');
    });
  });

  describe('when a text file is dropped', () => {
    it('attaches it to the composer', async () => {
      renderComposer();
      const notes = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      Object.defineProperty(notes, 'text', { value: async () => 'hello' });
      dropOnWindow([notes]);
      expect(await screen.findByRole('button', { name: 'Preview notes.txt' })).toBeTruthy();
    });
  });

  describe('when an unsupported spreadsheet is dropped', () => {
    it('explains how to attach readable data instead', async () => {
      renderComposer();
      dropOnWindow([new File(['binary'], 'leads.xlsx')]);
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('leads.xlsx');
      expect(alert.textContent).toContain('CSV');
    });
  });

  describe('when the composer is disabled', () => {
    it('ignores dragged files', () => {
      renderComposer(true);
      dropOnWindow([new File(['hello'], 'notes.txt', { type: 'text/plain' })]);
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Preview notes.txt' })).toBeNull();
    });
  });
});
