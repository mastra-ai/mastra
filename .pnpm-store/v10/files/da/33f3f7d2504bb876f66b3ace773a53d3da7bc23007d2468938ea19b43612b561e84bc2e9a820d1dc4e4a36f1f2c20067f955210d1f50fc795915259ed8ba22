"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault")["default"];
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.githubLightStyle = exports.githubLightInit = exports.githubLight = exports.githubDarkStyle = exports.githubDarkInit = exports.githubDark = exports.defaultSettingsGithubLight = exports.defaultSettingsGithubDark = void 0;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));
var _highlight = require("@lezer/highlight");
var _codemirrorThemes = require("@uiw/codemirror-themes");
/**
 * @name github
 */

var defaultSettingsGithubLight = exports.defaultSettingsGithubLight = {
  background: '#fff',
  foreground: '#24292e',
  selection: '#BBDFFF',
  selectionMatch: '#BBDFFF',
  gutterBackground: '#fff',
  gutterForeground: '#6e7781'
};
var githubLightStyle = exports.githubLightStyle = [{
  tag: [_highlight.tags.standard(_highlight.tags.tagName), _highlight.tags.tagName],
  color: '#116329'
}, {
  tag: [_highlight.tags.comment, _highlight.tags.bracket],
  color: '#6a737d'
}, {
  tag: [_highlight.tags.className, _highlight.tags.propertyName],
  color: '#6f42c1'
}, {
  tag: [_highlight.tags.variableName, _highlight.tags.attributeName, _highlight.tags.number, _highlight.tags.operator],
  color: '#005cc5'
}, {
  tag: [_highlight.tags.keyword, _highlight.tags.typeName, _highlight.tags.typeOperator, _highlight.tags.typeName],
  color: '#d73a49'
}, {
  tag: [_highlight.tags.string, _highlight.tags.meta, _highlight.tags.regexp],
  color: '#032f62'
}, {
  tag: [_highlight.tags.name, _highlight.tags.quote],
  color: '#22863a'
}, {
  tag: [_highlight.tags.heading, _highlight.tags.strong],
  color: '#24292e',
  fontWeight: 'bold'
}, {
  tag: [_highlight.tags.emphasis],
  color: '#24292e',
  fontStyle: 'italic'
}, {
  tag: [_highlight.tags.deleted],
  color: '#b31d28',
  backgroundColor: 'ffeef0'
}, {
  tag: [_highlight.tags.atom, _highlight.tags.bool, _highlight.tags.special(_highlight.tags.variableName)],
  color: '#e36209'
}, {
  tag: [_highlight.tags.url, _highlight.tags.escape, _highlight.tags.regexp, _highlight.tags.link],
  color: '#032f62'
}, {
  tag: _highlight.tags.link,
  textDecoration: 'underline'
}, {
  tag: _highlight.tags.strikethrough,
  textDecoration: 'line-through'
}, {
  tag: _highlight.tags.invalid,
  color: '#cb2431'
}];
var githubLightInit = exports.githubLightInit = function githubLightInit(options) {
  var _ref = options || {},
    _ref$theme = _ref.theme,
    theme = _ref$theme === void 0 ? 'light' : _ref$theme,
    _ref$settings = _ref.settings,
    settings = _ref$settings === void 0 ? {} : _ref$settings,
    _ref$styles = _ref.styles,
    styles = _ref$styles === void 0 ? [] : _ref$styles;
  return (0, _codemirrorThemes.createTheme)({
    theme: theme,
    settings: (0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, defaultSettingsGithubLight), settings),
    styles: [].concat(githubLightStyle, (0, _toConsumableArray2["default"])(styles))
  });
};
var githubLight = exports.githubLight = githubLightInit();
var defaultSettingsGithubDark = exports.defaultSettingsGithubDark = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  caret: '#c9d1d9',
  selection: '#003d73',
  selectionMatch: '#003d73',
  lineHighlight: '#36334280'
};
var githubDarkStyle = exports.githubDarkStyle = [{
  tag: [_highlight.tags.standard(_highlight.tags.tagName), _highlight.tags.tagName],
  color: '#7ee787'
}, {
  tag: [_highlight.tags.comment, _highlight.tags.bracket],
  color: '#8b949e'
}, {
  tag: [_highlight.tags.className, _highlight.tags.propertyName],
  color: '#d2a8ff'
}, {
  tag: [_highlight.tags.variableName, _highlight.tags.attributeName, _highlight.tags.number, _highlight.tags.operator],
  color: '#79c0ff'
}, {
  tag: [_highlight.tags.keyword, _highlight.tags.typeName, _highlight.tags.typeOperator, _highlight.tags.typeName],
  color: '#ff7b72'
}, {
  tag: [_highlight.tags.string, _highlight.tags.meta, _highlight.tags.regexp],
  color: '#a5d6ff'
}, {
  tag: [_highlight.tags.name, _highlight.tags.quote],
  color: '#7ee787'
}, {
  tag: [_highlight.tags.heading, _highlight.tags.strong],
  color: '#d2a8ff',
  fontWeight: 'bold'
}, {
  tag: [_highlight.tags.emphasis],
  color: '#d2a8ff',
  fontStyle: 'italic'
}, {
  tag: [_highlight.tags.deleted],
  color: '#ffdcd7',
  backgroundColor: 'ffeef0'
}, {
  tag: [_highlight.tags.atom, _highlight.tags.bool, _highlight.tags.special(_highlight.tags.variableName)],
  color: '#ffab70'
}, {
  tag: _highlight.tags.link,
  textDecoration: 'underline'
}, {
  tag: _highlight.tags.strikethrough,
  textDecoration: 'line-through'
}, {
  tag: _highlight.tags.invalid,
  color: '#f97583'
}];
var githubDarkInit = exports.githubDarkInit = function githubDarkInit(options) {
  var _ref2 = options || {},
    _ref2$theme = _ref2.theme,
    theme = _ref2$theme === void 0 ? 'dark' : _ref2$theme,
    _ref2$settings = _ref2.settings,
    settings = _ref2$settings === void 0 ? {} : _ref2$settings,
    _ref2$styles = _ref2.styles,
    styles = _ref2$styles === void 0 ? [] : _ref2$styles;
  return (0, _codemirrorThemes.createTheme)({
    theme: theme,
    settings: (0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, defaultSettingsGithubDark), settings),
    styles: [].concat(githubDarkStyle, (0, _toConsumableArray2["default"])(styles))
  });
};
var githubDark = exports.githubDark = githubDarkInit();