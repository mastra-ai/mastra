interface EditKeyboardInput {
  alt?: boolean;
  code?: string;
  control?: boolean;
  key?: string;
  meta?: boolean;
  shift?: boolean;
  type?: string;
}

export type EditKeyboardCommand = 'paste' | 'pasteAndMatchStyle';

export function editCommandForKeyboardInput(input: EditKeyboardInput): EditKeyboardCommand | undefined {
  if (input.type !== 'keyDown') return undefined;

  const hasPasteModifier = process.platform === 'darwin' ? input.meta : input.control;
  const isV = input.key?.toLowerCase() === 'v' || input.code === 'KeyV';

  if (!hasPasteModifier || input.alt || !isV) return undefined;

  return input.shift ? 'pasteAndMatchStyle' : 'paste';
}
