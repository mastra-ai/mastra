"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  getDefaultExtensions: true
};
exports.getDefaultExtensions = void 0;
var _commands = require("@codemirror/commands");
var _codemirrorExtensionsBasicSetup = require("@uiw/codemirror-extensions-basic-setup");
var _view = require("@codemirror/view");
var _themeOneDark = require("@codemirror/theme-one-dark");
Object.keys(_themeOneDark).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _themeOneDark[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _themeOneDark[key];
    }
  });
});
var _state = require("@codemirror/state");
var _light = require("./theme/light");
Object.keys(_light).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _light[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _light[key];
    }
  });
});
var getDefaultExtensions = exports.getDefaultExtensions = function getDefaultExtensions() {
  var optios = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var _optios$indentWithTab = optios.indentWithTab,
    defaultIndentWithTab = _optios$indentWithTab === void 0 ? true : _optios$indentWithTab,
    _optios$editable = optios.editable,
    editable = _optios$editable === void 0 ? true : _optios$editable,
    _optios$readOnly = optios.readOnly,
    readOnly = _optios$readOnly === void 0 ? false : _optios$readOnly,
    _optios$theme = optios.theme,
    theme = _optios$theme === void 0 ? 'light' : _optios$theme,
    _optios$placeholder = optios.placeholder,
    placeholderStr = _optios$placeholder === void 0 ? '' : _optios$placeholder,
    _optios$basicSetup = optios.basicSetup,
    defaultBasicSetup = _optios$basicSetup === void 0 ? true : _optios$basicSetup;
  var getExtensions = [];
  if (defaultIndentWithTab) {
    getExtensions.unshift(_view.keymap.of([_commands.indentWithTab]));
  }
  if (defaultBasicSetup) {
    if (typeof defaultBasicSetup === 'boolean') {
      getExtensions.unshift((0, _codemirrorExtensionsBasicSetup.basicSetup)());
    } else {
      getExtensions.unshift((0, _codemirrorExtensionsBasicSetup.basicSetup)(defaultBasicSetup));
    }
  }
  if (placeholderStr) {
    getExtensions.unshift((0, _view.placeholder)(placeholderStr));
  }
  switch (theme) {
    case 'light':
      getExtensions.push(_light.defaultLightThemeOption);
      break;
    case 'dark':
      getExtensions.push(_themeOneDark.oneDark);
      break;
    case 'none':
      break;
    default:
      getExtensions.push(theme);
      break;
  }
  if (editable === false) {
    getExtensions.push(_view.EditorView.editable.of(false));
  }
  if (readOnly) {
    getExtensions.push(_state.EditorState.readOnly.of(true));
  }
  return [].concat(getExtensions);
};