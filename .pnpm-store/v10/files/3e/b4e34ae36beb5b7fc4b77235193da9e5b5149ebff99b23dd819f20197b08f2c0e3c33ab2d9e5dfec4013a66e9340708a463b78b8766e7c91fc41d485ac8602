import _extends from "@babel/runtime/helpers/extends";
/**
 * @name dracula
 * @author dracula
 * Michael Kaminsky (http://github.com/mkaminsky11)
 * Original dracula color scheme by Zeno Rocha (https://github.com/zenorocha/dracula-theme)
 */
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
export var defaultSettingsDracula = {
  background: '#282a36',
  foreground: '#f8f8f2',
  caret: '#f8f8f0',
  selection: 'rgba(255, 255, 255, 0.1)',
  selectionMatch: 'rgba(255, 255, 255, 0.2)',
  gutterBackground: '#282a36',
  gutterForeground: '#6D8A88',
  gutterBorder: 'transparent',
  lineHighlight: 'rgba(255, 255, 255, 0.1)'
};
export var draculaDarkStyle = [{
  tag: t.comment,
  color: '#6272a4'
}, {
  tag: t.string,
  color: '#f1fa8c'
}, {
  tag: t.atom,
  color: '#bd93f9'
}, {
  tag: t.meta,
  color: '#f8f8f2'
}, {
  tag: [t.keyword, t.operator, t.tagName],
  color: '#ff79c6'
}, {
  tag: [t.function(t.propertyName), t.propertyName],
  color: '#66d9ef'
}, {
  tag: [t.definition(t.variableName), t.function(t.variableName), t.className, t.attributeName],
  color: '#50fa7b'
}, {
  tag: t.atom,
  color: '#bd93f9'
}];
export var draculaInit = options => {
  var {
    theme = 'dark',
    settings = {},
    styles = []
  } = options || {};
  return createTheme({
    theme: theme,
    settings: _extends({}, defaultSettingsDracula, settings),
    styles: [...draculaDarkStyle, ...styles]
  });
};
export var dracula = draculaInit();