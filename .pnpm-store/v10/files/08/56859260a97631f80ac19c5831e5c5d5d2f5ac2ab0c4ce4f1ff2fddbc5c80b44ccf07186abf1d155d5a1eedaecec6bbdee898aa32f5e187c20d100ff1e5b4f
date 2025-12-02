"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault")["default"];
var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard")["default"];
Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {};
exports["default"] = void 0;
var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));
var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireWildcard(require("react"));
var _useCodeMirror2 = require("./useCodeMirror");
Object.keys(_useCodeMirror2).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _useCodeMirror2[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _useCodeMirror2[key];
    }
  });
});
var _jsxRuntime = require("react/jsx-runtime");
var _view = require("@codemirror/view");
Object.keys(_view).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _view[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _view[key];
    }
  });
});
var _state = require("@codemirror/state");
Object.keys(_state).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _state[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _state[key];
    }
  });
});
var _codemirrorExtensionsBasicSetup = require("@uiw/codemirror-extensions-basic-setup");
Object.keys(_codemirrorExtensionsBasicSetup).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _codemirrorExtensionsBasicSetup[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _codemirrorExtensionsBasicSetup[key];
    }
  });
});
var _getDefaultExtensions = require("./getDefaultExtensions");
Object.keys(_getDefaultExtensions).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _getDefaultExtensions[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _getDefaultExtensions[key];
    }
  });
});
var _utils = require("./utils");
Object.keys(_utils).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _utils[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _utils[key];
    }
  });
});
var _excluded = ["className", "value", "selection", "extensions", "onChange", "onStatistics", "onCreateEditor", "onUpdate", "autoFocus", "theme", "height", "minHeight", "maxHeight", "width", "minWidth", "maxWidth", "basicSetup", "placeholder", "indentWithTab", "editable", "readOnly", "root", "initialState"];
var ReactCodeMirror = /*#__PURE__*/(0, _react.forwardRef)(function (props, ref) {
  var className = props.className,
    _props$value = props.value,
    value = _props$value === void 0 ? '' : _props$value,
    selection = props.selection,
    _props$extensions = props.extensions,
    extensions = _props$extensions === void 0 ? [] : _props$extensions,
    onChange = props.onChange,
    onStatistics = props.onStatistics,
    onCreateEditor = props.onCreateEditor,
    onUpdate = props.onUpdate,
    autoFocus = props.autoFocus,
    _props$theme = props.theme,
    theme = _props$theme === void 0 ? 'light' : _props$theme,
    height = props.height,
    minHeight = props.minHeight,
    maxHeight = props.maxHeight,
    width = props.width,
    minWidth = props.minWidth,
    maxWidth = props.maxWidth,
    basicSetup = props.basicSetup,
    placeholder = props.placeholder,
    indentWithTab = props.indentWithTab,
    editable = props.editable,
    readOnly = props.readOnly,
    root = props.root,
    initialState = props.initialState,
    other = (0, _objectWithoutProperties2["default"])(props, _excluded);
  var editor = (0, _react.useRef)(null);
  var _useCodeMirror = (0, _useCodeMirror2.useCodeMirror)({
      root: root,
      value: value,
      autoFocus: autoFocus,
      theme: theme,
      height: height,
      minHeight: minHeight,
      maxHeight: maxHeight,
      width: width,
      minWidth: minWidth,
      maxWidth: maxWidth,
      basicSetup: basicSetup,
      placeholder: placeholder,
      indentWithTab: indentWithTab,
      editable: editable,
      readOnly: readOnly,
      selection: selection,
      onChange: onChange,
      onStatistics: onStatistics,
      onCreateEditor: onCreateEditor,
      onUpdate: onUpdate,
      extensions: extensions,
      initialState: initialState
    }),
    state = _useCodeMirror.state,
    view = _useCodeMirror.view,
    container = _useCodeMirror.container,
    setContainer = _useCodeMirror.setContainer;
  (0, _react.useImperativeHandle)(ref, function () {
    return {
      editor: editor.current,
      state: state,
      view: view
    };
  }, [editor, container, state, view]);
  var setEditorRef = (0, _react.useCallback)(function (el) {
    editor.current = el;
    setContainer(el);
  }, [setContainer]);

  // check type of value
  if (typeof value !== 'string') {
    throw new Error("value must be typeof string but got ".concat((0, _typeof2["default"])(value)));
  }
  var defaultClassNames = typeof theme === 'string' ? "cm-theme-".concat(theme) : 'cm-theme';
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", (0, _objectSpread2["default"])({
    ref: setEditorRef,
    className: "".concat(defaultClassNames).concat(className ? " ".concat(className) : '')
  }, other));
});
ReactCodeMirror.displayName = 'CodeMirror';
var _default = exports["default"] = ReactCodeMirror;