"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.createTheme = void 0;
var _view = require("@codemirror/view");
var _language = require("@codemirror/language");
var createTheme = exports.createTheme = function createTheme(_ref) {
  var theme = _ref.theme,
    _ref$settings = _ref.settings,
    settings = _ref$settings === void 0 ? {} : _ref$settings,
    _ref$styles = _ref.styles,
    styles = _ref$styles === void 0 ? [] : _ref$styles;
  var themeOptions = {
    '.cm-gutters': {}
  };
  var baseStyle = {};
  if (settings.background) {
    baseStyle.backgroundColor = settings.background;
  }
  if (settings.backgroundImage) {
    baseStyle.backgroundImage = settings.backgroundImage;
  }
  if (settings.foreground) {
    baseStyle.color = settings.foreground;
  }
  if (settings.fontSize) {
    baseStyle.fontSize = settings.fontSize;
  }
  if (settings.background || settings.foreground) {
    themeOptions['&'] = baseStyle;
  }
  if (settings.fontFamily) {
    themeOptions['&.cm-editor .cm-scroller'] = {
      fontFamily: settings.fontFamily
    };
  }
  if (settings.gutterBackground) {
    themeOptions['.cm-gutters'].backgroundColor = settings.gutterBackground;
  }
  if (settings.gutterForeground) {
    themeOptions['.cm-gutters'].color = settings.gutterForeground;
  }
  if (settings.gutterBorder) {
    themeOptions['.cm-gutters'].borderRightColor = settings.gutterBorder;
  }
  if (settings.caret) {
    themeOptions['.cm-content'] = {
      caretColor: settings.caret
    };
    themeOptions['.cm-cursor, .cm-dropCursor'] = {
      borderLeftColor: settings.caret
    };
  }
  var activeLineGutterStyle = {};
  if (settings.gutterActiveForeground) {
    activeLineGutterStyle.color = settings.gutterActiveForeground;
  }
  if (settings.lineHighlight) {
    themeOptions['.cm-activeLine'] = {
      backgroundColor: settings.lineHighlight
    };
    activeLineGutterStyle.backgroundColor = settings.lineHighlight;
  }
  themeOptions['.cm-activeLineGutter'] = activeLineGutterStyle;
  if (settings.selection) {
    themeOptions['&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection'] = {
      background: settings.selection + ' !important'
    };
  }
  if (settings.selectionMatch) {
    themeOptions['& .cm-selectionMatch'] = {
      backgroundColor: settings.selectionMatch
    };
  }
  var themeExtension = _view.EditorView.theme(themeOptions, {
    dark: theme === 'dark'
  });
  var highlightStyle = _language.HighlightStyle.define(styles);
  var extension = [themeExtension, (0, _language.syntaxHighlighting)(highlightStyle)];
  return extension;
};
var _default = exports["default"] = createTheme;