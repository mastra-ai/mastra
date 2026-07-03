import { describe, expect, it } from 'vitest';
import { buildEditableContextMenuTemplate, EDIT_MENU_TEMPLATE } from './edit-menu';

describe('EDIT_MENU_TEMPLATE', () => {
  describe('when Electron builds the app menu', () => {
    it('includes native paste commands for focused inputs', () => {
      expect(EDIT_MENU_TEMPLATE).toMatchObject({
        label: 'Edit',
        submenu: expect.arrayContaining([{ role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'selectAll' }]),
      });
    });
  });
});

describe('buildEditableContextMenuTemplate', () => {
  describe('when the context target is not editable', () => {
    it('does not show an editing context menu', () => {
      expect(buildEditableContextMenuTemplate({ isEditable: false, editFlags: {} })).toEqual([]);
    });
  });

  describe('when the context target is editable', () => {
    it('enables paste commands from Electron edit flags', () => {
      const template = buildEditableContextMenuTemplate({
        isEditable: true,
        editFlags: {
          canCopy: true,
          canCut: true,
          canPaste: true,
          canRedo: false,
          canSelectAll: true,
          canUndo: false,
        },
      });

      expect(template).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'paste', enabled: true }),
          expect.objectContaining({ role: 'pasteAndMatchStyle', enabled: true }),
          expect.objectContaining({ role: 'selectAll', enabled: true }),
        ]),
      );
    });

    it('uses custom paste actions when provided', () => {
      const onPaste = () => undefined;
      const onPasteAndMatchStyle = () => undefined;
      const template = buildEditableContextMenuTemplate({
        isEditable: true,
        editFlags: {
          canPaste: true,
        },
        onPaste,
        onPasteAndMatchStyle,
      });

      expect(template).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Paste', enabled: true, click: onPaste }),
          expect.objectContaining({
            label: 'Paste and Match Style',
            enabled: true,
            click: onPasteAndMatchStyle,
          }),
        ]),
      );
    });
  });
});
