"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault")["default"];
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ExternalChange = void 0;
exports.useCodeMirror = useCodeMirror;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = require("react");
var _state = require("@codemirror/state");
var _view = require("@codemirror/view");
var _getDefaultExtensions = require("./getDefaultExtensions");
var _utils = require("./utils");
var _timeoutLatch = require("./timeoutLatch");
var ExternalChange = exports.ExternalChange = _state.Annotation.define();
var TYPING_TIMOUT = 200; // ms

var emptyExtensions = [];
function useCodeMirror(props) {
  var value = props.value,
    selection = props.selection,
    onChange = props.onChange,
    onStatistics = props.onStatistics,
    onCreateEditor = props.onCreateEditor,
    onUpdate = props.onUpdate,
    _props$extensions = props.extensions,
    extensions = _props$extensions === void 0 ? emptyExtensions : _props$extensions,
    autoFocus = props.autoFocus,
    _props$theme = props.theme,
    theme = _props$theme === void 0 ? 'light' : _props$theme,
    _props$height = props.height,
    height = _props$height === void 0 ? null : _props$height,
    _props$minHeight = props.minHeight,
    minHeight = _props$minHeight === void 0 ? null : _props$minHeight,
    _props$maxHeight = props.maxHeight,
    maxHeight = _props$maxHeight === void 0 ? null : _props$maxHeight,
    _props$width = props.width,
    width = _props$width === void 0 ? null : _props$width,
    _props$minWidth = props.minWidth,
    minWidth = _props$minWidth === void 0 ? null : _props$minWidth,
    _props$maxWidth = props.maxWidth,
    maxWidth = _props$maxWidth === void 0 ? null : _props$maxWidth,
    _props$placeholder = props.placeholder,
    placeholderStr = _props$placeholder === void 0 ? '' : _props$placeholder,
    _props$editable = props.editable,
    editable = _props$editable === void 0 ? true : _props$editable,
    _props$readOnly = props.readOnly,
    readOnly = _props$readOnly === void 0 ? false : _props$readOnly,
    _props$indentWithTab = props.indentWithTab,
    defaultIndentWithTab = _props$indentWithTab === void 0 ? true : _props$indentWithTab,
    _props$basicSetup = props.basicSetup,
    defaultBasicSetup = _props$basicSetup === void 0 ? true : _props$basicSetup,
    root = props.root,
    initialState = props.initialState;
  var _useState = (0, _react.useState)(),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    container = _useState2[0],
    setContainer = _useState2[1];
  var _useState3 = (0, _react.useState)(),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    view = _useState4[0],
    setView = _useState4[1];
  var _useState5 = (0, _react.useState)(),
    _useState6 = (0, _slicedToArray2["default"])(_useState5, 2),
    state = _useState6[0],
    setState = _useState6[1];
  var typingLatch = (0, _react.useState)(function () {
    return {
      current: null
    };
  })[0];
  var pendingUpdate = (0, _react.useState)(function () {
    return {
      current: null
    };
  })[0];
  var defaultThemeOption = _view.EditorView.theme({
    '&': {
      height: height,
      minHeight: minHeight,
      maxHeight: maxHeight,
      width: width,
      minWidth: minWidth,
      maxWidth: maxWidth
    },
    '& .cm-scroller': {
      height: '100% !important'
    }
  });
  var updateListener = _view.EditorView.updateListener.of(function (vu) {
    if (vu.docChanged && typeof onChange === 'function' &&
    // Fix echoing of the remote changes:
    // If transaction is market as remote we don't have to call `onChange` handler again
    !vu.transactions.some(function (tr) {
      return tr.annotation(ExternalChange);
    })) {
      if (typingLatch.current) {
        typingLatch.current.reset();
      } else {
        typingLatch.current = new _timeoutLatch.TimeoutLatch(function () {
          if (pendingUpdate.current) {
            var forceUpdate = pendingUpdate.current;
            pendingUpdate.current = null;
            forceUpdate();
          }
          typingLatch.current = null;
        }, TYPING_TIMOUT);
        (0, _timeoutLatch.getScheduler)().add(typingLatch.current);
      }
      var doc = vu.state.doc;
      var _value = doc.toString();
      onChange(_value, vu);
    }
    onStatistics && onStatistics((0, _utils.getStatistics)(vu));
  });
  var defaultExtensions = (0, _getDefaultExtensions.getDefaultExtensions)({
    theme: theme,
    editable: editable,
    readOnly: readOnly,
    placeholder: placeholderStr,
    indentWithTab: defaultIndentWithTab,
    basicSetup: defaultBasicSetup
  });
  var getExtensions = [updateListener, defaultThemeOption].concat((0, _toConsumableArray2["default"])(defaultExtensions));
  if (onUpdate && typeof onUpdate === 'function') {
    getExtensions.push(_view.EditorView.updateListener.of(onUpdate));
  }
  getExtensions = getExtensions.concat(extensions);
  (0, _react.useLayoutEffect)(function () {
    if (container && !state) {
      var config = {
        doc: value,
        selection: selection,
        extensions: getExtensions
      };
      var stateCurrent = initialState ? _state.EditorState.fromJSON(initialState.json, config, initialState.fields) : _state.EditorState.create(config);
      setState(stateCurrent);
      if (!view) {
        var viewCurrent = new _view.EditorView({
          state: stateCurrent,
          parent: container,
          root: root
        });
        setView(viewCurrent);
        onCreateEditor && onCreateEditor(viewCurrent, stateCurrent);
      }
    }
    return function () {
      if (view) {
        setState(undefined);
        setView(undefined);
      }
    };
  }, [container, state]);
  (0, _react.useEffect)(function () {
    if (props.container) {
      setContainer(props.container);
    }
  }, [props.container]);
  (0, _react.useEffect)(function () {
    return function () {
      if (view) {
        view.destroy();
        setView(undefined);
      }
      if (typingLatch.current) {
        typingLatch.current.cancel();
        typingLatch.current = null;
      }
    };
  }, [view]);
  (0, _react.useEffect)(function () {
    if (autoFocus && view) {
      view.focus();
    }
  }, [autoFocus, view]);
  (0, _react.useEffect)(function () {
    if (view) {
      view.dispatch({
        effects: _state.StateEffect.reconfigure.of(getExtensions)
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, extensions, height, minHeight, maxHeight, width, minWidth, maxWidth, placeholderStr, editable, readOnly, defaultIndentWithTab, defaultBasicSetup, onChange, onUpdate]);
  (0, _react.useEffect)(function () {
    if (value === undefined) {
      return;
    }
    var currentValue = view ? view.state.doc.toString() : '';
    if (view && value !== currentValue) {
      var isTyping = typingLatch.current && !typingLatch.current.isDone;
      var forceUpdate = function forceUpdate() {
        if (view && value !== view.state.doc.toString()) {
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.toString().length,
              insert: value || ''
            },
            annotations: [ExternalChange.of(true)]
          });
        }
      };
      if (!isTyping) {
        forceUpdate();
      } else {
        pendingUpdate.current = forceUpdate;
      }
    }
  }, [value, view]);
  return {
    state: state,
    setState: setState,
    view: view,
    setView: setView,
    container: container,
    setContainer: setContainer
  };
}