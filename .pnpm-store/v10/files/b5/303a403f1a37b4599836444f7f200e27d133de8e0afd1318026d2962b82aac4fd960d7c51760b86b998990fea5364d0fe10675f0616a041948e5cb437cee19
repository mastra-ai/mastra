import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
export var createTheme = _ref => {
  var {
    theme,
    settings = {},
    styles = []
  } = _ref;
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
  var themeExtension = EditorView.theme(themeOptions, {
    dark: theme === 'dark'
  });
  var highlightStyle = HighlightStyle.define(styles);
  var extension = [themeExtension, syntaxHighlighting(highlightStyle)];
  return extension;
};
export default createTheme;