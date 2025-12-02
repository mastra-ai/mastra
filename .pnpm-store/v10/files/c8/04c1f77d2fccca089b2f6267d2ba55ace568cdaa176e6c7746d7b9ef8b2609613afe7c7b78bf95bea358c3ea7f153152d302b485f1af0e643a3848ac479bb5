"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault")["default"];
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.draculaInit = exports.draculaDarkStyle = exports.dracula = exports.defaultSettingsDracula = void 0;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));
var _highlight = require("@lezer/highlight");
var _codemirrorThemes = require("@uiw/codemirror-themes");
/**
 * @name dracula
 * @author dracula
 * Michael Kaminsky (http://github.com/mkaminsky11)
 * Original dracula color scheme by Zeno Rocha (https://github.com/zenorocha/dracula-theme)
 */

var defaultSettingsDracula = exports.defaultSettingsDracula = {
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
var draculaDarkStyle = exports.draculaDarkStyle = [{
  tag: _highlight.tags.comment,
  color: '#6272a4'
}, {
  tag: _highlight.tags.string,
  color: '#f1fa8c'
}, {
  tag: _highlight.tags.atom,
  color: '#bd93f9'
}, {
  tag: _highlight.tags.meta,
  color: '#f8f8f2'
}, {
  tag: [_highlight.tags.keyword, _highlight.tags.operator, _highlight.tags.tagName],
  color: '#ff79c6'
}, {
  tag: [_highlight.tags["function"](_highlight.tags.propertyName), _highlight.tags.propertyName],
  color: '#66d9ef'
}, {
  tag: [_highlight.tags.definition(_highlight.tags.variableName), _highlight.tags["function"](_highlight.tags.variableName), _highlight.tags.className, _highlight.tags.attributeName],
  color: '#50fa7b'
}, {
  tag: _highlight.tags.atom,
  color: '#bd93f9'
}];
var draculaInit = exports.draculaInit = function draculaInit(options) {
  var _ref = options || {},
    _ref$theme = _ref.theme,
    theme = _ref$theme === void 0 ? 'dark' : _ref$theme,
    _ref$settings = _ref.settings,
    settings = _ref$settings === void 0 ? {} : _ref$settings,
    _ref$styles = _ref.styles,
    styles = _ref$styles === void 0 ? [] : _ref$styles;
  return (0, _codemirrorThemes.createTheme)({
    theme: theme,
    settings: (0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, defaultSettingsDracula), settings),
    styles: [].concat(draculaDarkStyle, (0, _toConsumableArray2["default"])(styles))
  });
};
var dracula = exports.dracula = draculaInit();