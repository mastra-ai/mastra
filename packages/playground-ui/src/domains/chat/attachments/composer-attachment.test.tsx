// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileChipEntry, TxtEntry } from './attachment-preview-dialog';
import { ComposerAttachment } from './composer-attachment';

afterEach(cleanup);

describe('ComposerAttachment', () => {
  describe('when a keyboard menu action does not move focus', () => {
    it('returns focus to the opener after an inline edit', async () => {
      function InlineEdit() {
        const [name, setName] = useState('notes.txt');
        return (
          <ComposerAttachment name={name} onRemove={() => {}} onEdit={() => setName('revised.txt')}>
            <TxtEntry name={name} data="Attached notes" />
          </ComposerAttachment>
        );
      }
      render(<InlineEdit />);
      const opener = screen.getByRole('button', { name: 'Edit notes.txt' });
      opener.focus();
      fireEvent.keyDown(opener, { key: 'F10', shiftKey: true });
      const edit = await screen.findByRole('menuitem', { name: 'Edit' });
      act(() => edit.focus());
      fireEvent.keyDown(edit, { key: 'Enter' });

      expect(screen.getByRole('button', { name: 'Preview revised.txt' })).not.toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(opener));
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('when a menu action moves focus to another control', () => {
    it('preserves the application focus target', async () => {
      render(
        <>
          <input aria-label="Filename" />
          <ComposerAttachment
            name="notes.txt"
            onRemove={() => {}}
            onEdit={() => screen.getByLabelText('Filename').focus()}
          >
            <TxtEntry name="notes.txt" data="Attached notes" />
          </ComposerAttachment>
        </>,
      );
      const opener = screen.getByRole('button', { name: 'Edit notes.txt' });
      opener.focus();
      fireEvent.keyDown(opener, { key: 'F10', shiftKey: true });
      const edit = await screen.findByRole('menuitem', { name: 'Edit' });
      act(() => edit.focus());
      fireEvent.keyDown(edit, { key: 'Enter' });

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filename' }));
    });
  });

  describe('when a focused action opens the context menu with a right click', () => {
    it.each(['Remove', 'Edit'])('returns focus to %s on dismissal', async actionName => {
      render(
        <ComposerAttachment name="notes.txt" onRemove={() => {}} onEdit={() => {}}>
          <TxtEntry name="notes.txt" data="Attached notes" />
        </ComposerAttachment>,
      );
      const action = screen.getByRole('button', { name: `${actionName} notes.txt` });
      action.focus();
      fireEvent.contextMenu(action);
      const menu = await screen.findByRole('menu');
      menu.focus();
      fireEvent.keyDown(menu, { key: 'Escape' });

      await waitFor(() => expect(document.activeElement).toBe(action));
    });
  });

  describe('when the actions menu opens a preview', () => {
    it('shows the existing preview content without activating the file on menu open', async () => {
      render(
        <ComposerAttachment name="notes.txt" onRemove={() => {}}>
          <TxtEntry name="notes.txt" data="The actual attached notes" />
        </ComposerAttachment>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Actions for notes.txt' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Preview' }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('The actual attached notes');
      expect(screen.queryByRole('menu')).toBeNull();
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    });
  });

  describe('when the application supplies a preview callback', () => {
    it('uses that callback for files without a built-in preview control', async () => {
      const onPreview = vi.fn();
      render(
        <ComposerAttachment name="archive.zip" onRemove={() => {}} onPreview={onPreview}>
          <FileChipEntry name="archive.zip" />
        </ComposerAttachment>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Actions for archive.zip' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Preview' }));

      expect(onPreview).toHaveBeenCalledOnce();
    });
  });

  describe('when a static file has no editor or preview', () => {
    it('offers only removal in the native context menu', async () => {
      render(
        <ComposerAttachment name="archive.zip" onRemove={() => {}}>
          <FileChipEntry name="archive.zip" />
        </ComposerAttachment>,
      );

      fireEvent.contextMenu(screen.getByText('archive.zip'));

      const menu = await screen.findByRole('menu');
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
      expect(within(menu).getByRole('menuitem', { name: 'Remove' })).not.toBeNull();
    });
  });

  describe('when an attachment is edited and then removed through its menu', () => {
    it('updates only the selected attachment and preserves the other file', async () => {
      function Draft() {
        const [name, setName] = useState<string | undefined>('notes.txt');
        return (
          <>
            {name && (
              <ComposerAttachment name={name} onEdit={() => setName('revised.txt')} onRemove={() => setName(undefined)}>
                <TxtEntry name={name} data="Attached notes" />
              </ComposerAttachment>
            )}
            <ComposerAttachment name="archive.zip" onRemove={() => {}}>
              <FileChipEntry name="archive.zip" />
            </ComposerAttachment>
          </>
        );
      }
      render(<Draft />);

      fireEvent.click(screen.getByRole('button', { name: 'Actions for notes.txt' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
      expect(screen.getByRole('button', { name: 'Preview revised.txt' })).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Actions for revised.txt' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));

      expect(screen.queryByText('revised.txt')).toBeNull();
      expect(screen.getByText('archive.zip')).not.toBeNull();
    });
  });
});
