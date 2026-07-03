import type { MenuItemConstructorOptions } from 'electron';

interface EditableContextMenuParams {
  isEditable: boolean;
  editFlags: {
    canUndo?: boolean;
    canRedo?: boolean;
    canCut?: boolean;
    canCopy?: boolean;
    canPaste?: boolean;
    canSelectAll?: boolean;
  };
  onPaste?: () => void;
  onPasteAndMatchStyle?: () => void;
}

export const EDIT_MENU_TEMPLATE: MenuItemConstructorOptions = {
  label: 'Edit',
  submenu: [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'pasteAndMatchStyle' },
    { type: 'separator' },
    { role: 'selectAll' },
  ],
};

export function buildEditableContextMenuTemplate({
  editFlags,
  isEditable,
  onPaste,
  onPasteAndMatchStyle,
}: EditableContextMenuParams): MenuItemConstructorOptions[] {
  if (!isEditable) return [];

  return [
    { role: 'undo', enabled: Boolean(editFlags.canUndo) },
    { role: 'redo', enabled: Boolean(editFlags.canRedo) },
    { type: 'separator' },
    { role: 'cut', enabled: Boolean(editFlags.canCut) },
    { role: 'copy', enabled: Boolean(editFlags.canCopy) },
    onPaste
      ? { label: 'Paste', enabled: Boolean(editFlags.canPaste), click: onPaste }
      : { role: 'paste', enabled: Boolean(editFlags.canPaste) },
    onPasteAndMatchStyle
      ? { label: 'Paste and Match Style', enabled: Boolean(editFlags.canPaste), click: onPasteAndMatchStyle }
      : { role: 'pasteAndMatchStyle', enabled: Boolean(editFlags.canPaste) },
    { type: 'separator' },
    { role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) },
  ];
}
