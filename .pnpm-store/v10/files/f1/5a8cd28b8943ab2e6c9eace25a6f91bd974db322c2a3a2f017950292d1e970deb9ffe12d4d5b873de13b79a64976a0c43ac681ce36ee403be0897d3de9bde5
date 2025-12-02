"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minimalSetup = exports.basicSetup = void 0;
var _view = require("@codemirror/view");
var _state = require("@codemirror/state");
var _commands = require("@codemirror/commands");
var _search = require("@codemirror/search");
var _autocomplete = require("@codemirror/autocomplete");
var _language = require("@codemirror/language");
var _lint = require("@codemirror/lint");
/**
This is an extension value that just pulls together a number of
extensions that you might want in a basic editor. It is meant as a
convenient helper to quickly set up CodeMirror without installing
and importing a lot of separate packages.

Specifically, it includes...

 - [the default command bindings](https://codemirror.net/6/docs/ref/#commands.defaultKeymap)
 - [line numbers](https://codemirror.net/6/docs/ref/#view.lineNumbers)
 - [special character highlighting](https://codemirror.net/6/docs/ref/#view.highlightSpecialChars)
 - [the undo history](https://codemirror.net/6/docs/ref/#commands.history)
 - [a fold gutter](https://codemirror.net/6/docs/ref/#language.foldGutter)
 - [custom selection drawing](https://codemirror.net/6/docs/ref/#view.drawSelection)
 - [drop cursor](https://codemirror.net/6/docs/ref/#view.dropCursor)
 - [multiple selections](https://codemirror.net/6/docs/ref/#state.EditorState^allowMultipleSelections)
 - [reindentation on input](https://codemirror.net/6/docs/ref/#language.indentOnInput)
 - [the default highlight style](https://codemirror.net/6/docs/ref/#language.defaultHighlightStyle) (as fallback)
 - [bracket matching](https://codemirror.net/6/docs/ref/#language.bracketMatching)
 - [bracket closing](https://codemirror.net/6/docs/ref/#autocomplete.closeBrackets)
 - [autocompletion](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion)
 - [rectangular selection](https://codemirror.net/6/docs/ref/#view.rectangularSelection) and [crosshair cursor](https://codemirror.net/6/docs/ref/#view.crosshairCursor)
 - [active line highlighting](https://codemirror.net/6/docs/ref/#view.highlightActiveLine)
 - [active line gutter highlighting](https://codemirror.net/6/docs/ref/#view.highlightActiveLineGutter)
 - [selection match highlighting](https://codemirror.net/6/docs/ref/#search.highlightSelectionMatches)
 - [search](https://codemirror.net/6/docs/ref/#search.searchKeymap)
 - [linting](https://codemirror.net/6/docs/ref/#lint.lintKeymap)

(You'll probably want to add some language package to your setup
too.)

This extension does not allow customization. The idea is that,
once you decide you want to configure your editor more precisely,
you take this package's source (which is just a bunch of imports
and an array literal), copy it into your own code, and adjust it
as desired.
*/
var basicSetup = exports.basicSetup = function basicSetup() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var _options$crosshairCur = options.crosshairCursor,
    initCrosshairCursor = _options$crosshairCur === void 0 ? false : _options$crosshairCur;
  var keymaps = [];
  if (options.closeBracketsKeymap !== false) {
    keymaps = keymaps.concat(_autocomplete.closeBracketsKeymap);
  }
  if (options.defaultKeymap !== false) {
    keymaps = keymaps.concat(_commands.defaultKeymap);
  }
  if (options.searchKeymap !== false) {
    keymaps = keymaps.concat(_search.searchKeymap);
  }
  if (options.historyKeymap !== false) {
    keymaps = keymaps.concat(_commands.historyKeymap);
  }
  if (options.foldKeymap !== false) {
    keymaps = keymaps.concat(_language.foldKeymap);
  }
  if (options.completionKeymap !== false) {
    keymaps = keymaps.concat(_autocomplete.completionKeymap);
  }
  if (options.lintKeymap !== false) {
    keymaps = keymaps.concat(_lint.lintKeymap);
  }
  var extensions = [];
  if (options.lineNumbers !== false) extensions.push((0, _view.lineNumbers)());
  if (options.highlightActiveLineGutter !== false) extensions.push((0, _view.highlightActiveLineGutter)());
  if (options.highlightSpecialChars !== false) extensions.push((0, _view.highlightSpecialChars)());
  if (options.history !== false) extensions.push((0, _commands.history)());
  if (options.foldGutter !== false) extensions.push((0, _language.foldGutter)());
  if (options.drawSelection !== false) extensions.push((0, _view.drawSelection)());
  if (options.dropCursor !== false) extensions.push((0, _view.dropCursor)());
  if (options.allowMultipleSelections !== false) extensions.push(_state.EditorState.allowMultipleSelections.of(true));
  if (options.indentOnInput !== false) extensions.push((0, _language.indentOnInput)());
  if (options.syntaxHighlighting !== false) extensions.push((0, _language.syntaxHighlighting)(_language.defaultHighlightStyle, {
    fallback: true
  }));
  if (options.bracketMatching !== false) extensions.push((0, _language.bracketMatching)());
  if (options.closeBrackets !== false) extensions.push((0, _autocomplete.closeBrackets)());
  if (options.autocompletion !== false) extensions.push((0, _autocomplete.autocompletion)());
  if (options.rectangularSelection !== false) extensions.push((0, _view.rectangularSelection)());
  if (initCrosshairCursor !== false) extensions.push((0, _view.crosshairCursor)());
  if (options.highlightActiveLine !== false) extensions.push((0, _view.highlightActiveLine)());
  if (options.highlightSelectionMatches !== false) extensions.push((0, _search.highlightSelectionMatches)());
  if (options.tabSize && typeof options.tabSize === 'number') extensions.push(_language.indentUnit.of(' '.repeat(options.tabSize)));
  return extensions.concat([_view.keymap.of(keymaps.flat())]).filter(Boolean);
};
/**
A minimal set of extensions to create a functional editor. Only
includes [the default keymap](https://codemirror.net/6/docs/ref/#commands.defaultKeymap), [undo
history](https://codemirror.net/6/docs/ref/#commands.history), [special character
highlighting](https://codemirror.net/6/docs/ref/#view.highlightSpecialChars), [custom selection
drawing](https://codemirror.net/6/docs/ref/#view.drawSelection), and [default highlight
style](https://codemirror.net/6/docs/ref/#language.defaultHighlightStyle).
*/
var minimalSetup = exports.minimalSetup = function minimalSetup() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var keymaps = [];
  if (options.defaultKeymap !== false) {
    keymaps = keymaps.concat(_commands.defaultKeymap);
  }
  if (options.historyKeymap !== false) {
    keymaps = keymaps.concat(_commands.historyKeymap);
  }
  var extensions = [];
  if (options.highlightSpecialChars !== false) extensions.push((0, _view.highlightSpecialChars)());
  if (options.history !== false) extensions.push((0, _commands.history)());
  if (options.drawSelection !== false) extensions.push((0, _view.drawSelection)());
  if (options.syntaxHighlighting !== false) extensions.push((0, _language.syntaxHighlighting)(_language.defaultHighlightStyle, {
    fallback: true
  }));
  return extensions.concat([_view.keymap.of(keymaps.flat())]).filter(Boolean);
};