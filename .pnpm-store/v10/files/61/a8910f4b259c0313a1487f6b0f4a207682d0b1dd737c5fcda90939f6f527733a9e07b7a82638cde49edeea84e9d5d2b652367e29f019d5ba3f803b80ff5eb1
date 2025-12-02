import { indentWithTab } from '@codemirror/commands';
import { basicSetup } from '@uiw/codemirror-extensions-basic-setup';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { defaultLightThemeOption } from "./theme/light.js";
export * from '@codemirror/theme-one-dark';
export * from "./theme/light.js";
export var getDefaultExtensions = function getDefaultExtensions(optios) {
  if (optios === void 0) {
    optios = {};
  }
  var {
    indentWithTab: defaultIndentWithTab = true,
    editable = true,
    readOnly = false,
    theme = 'light',
    placeholder: placeholderStr = '',
    basicSetup: defaultBasicSetup = true
  } = optios;
  var getExtensions = [];
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