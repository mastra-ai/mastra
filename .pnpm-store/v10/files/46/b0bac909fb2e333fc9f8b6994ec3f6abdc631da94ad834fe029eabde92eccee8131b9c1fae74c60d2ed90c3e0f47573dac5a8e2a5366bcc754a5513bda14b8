import { type Extension } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { basicSetup, type BasicSetupOptions } from '@uiw/codemirror-extensions-basic-setup';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { defaultLightThemeOption } from './theme/light';

export * from '@codemirror/theme-one-dark';
export * from './theme/light';

export interface DefaultExtensionsOptions {
  indentWithTab?: boolean;
  basicSetup?: boolean | BasicSetupOptions;
  placeholder?: string | HTMLElement;
  theme?: 'light' | 'dark' | 'none' | Extension;
  readOnly?: boolean;
  editable?: boolean;
}

export const getDefaultExtensions = (optios: DefaultExtensionsOptions = {}): Extension[] => {
  const {
    indentWithTab: defaultIndentWithTab = true,
    editable = true,
    readOnly = false,
    theme = 'light',
    placeholder: placeholderStr = '',
    basicSetup: defaultBasicSetup = true,
  } = optios;
  const getExtensions: Extension[] = [];
  if (defaultIndentWithTab) {
    getExtensions.unshift(keymap.of([indentWithTab]));
  }
  if (defaultBasicSetup) {
    if (typeof defaultBasicSetup === 'boolean') {
      getExtensions.unshift(basicSetup());
    } else {
      getExtensions.unshift(basicSetup(defaultBasicSetup));
    }
  }
  if (placeholderStr) {
    getExtensions.unshift(placeholder(placeholderStr));
  }
  switch (theme) {
    case 'light':
      getExtensions.push(defaultLightThemeOption);
      break;
    case 'dark':
      getExtensions.push(oneDark);
      break;
    case 'none':
      break;
    default:
      getExtensions.push(theme);
      break;
  }
  if (editable === false) {
    getExtensions.push(EditorView.editable.of(false));
  }
  if (readOnly) {
    getExtensions.push(EditorState.readOnly.of(true));
  }

  return [...getExtensions];
};
