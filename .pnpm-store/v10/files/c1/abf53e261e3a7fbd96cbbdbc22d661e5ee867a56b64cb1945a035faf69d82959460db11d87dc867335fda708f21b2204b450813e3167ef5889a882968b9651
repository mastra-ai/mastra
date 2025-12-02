import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "value", "selection", "extensions", "onChange", "onStatistics", "onCreateEditor", "onUpdate", "autoFocus", "theme", "height", "minHeight", "maxHeight", "width", "minWidth", "maxWidth", "basicSetup", "placeholder", "indentWithTab", "editable", "readOnly", "root", "initialState"];
import React, { useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useCodeMirror } from "./useCodeMirror.js";
import { jsx as _jsx } from "react/jsx-runtime";
export * from '@codemirror/view';
export * from '@codemirror/state';
export * from '@uiw/codemirror-extensions-basic-setup';
export * from "./useCodeMirror.js";
export * from "./getDefaultExtensions.js";
export * from "./utils.js";
var ReactCodeMirror = /*#__PURE__*/forwardRef((props, ref) => {
  var {
      className,
      value = '',
      selection,
      extensions = [],
      onChange,
      onStatistics,
      onCreateEditor,
      onUpdate,
      autoFocus,
      theme = 'light',
      height,
      minHeight,
      maxHeight,
      width,
      minWidth,
      maxWidth,
      basicSetup,
      placeholder,
      indentWithTab,
      editable,
      readOnly,
      root,
      initialState
    } = props,
    other = _objectWithoutPropertiesLoose(props, _excluded);
  var editor = useRef(null);
  var {
    state,
    view,
    container,
    setContainer
  } = useCodeMirror({
    root,
    value,
    autoFocus,
    theme,
    height,
    minHeight,
    maxHeight,
    width,
    minWidth,
    maxWidth,
    basicSetup,
    placeholder,
    indentWithTab,
    editable,
    readOnly,
    selection,
    onChange,
    onStatistics,
    onCreateEditor,
    onUpdate,
    extensions,
    initialState
  });
  useImperativeHandle(ref, () => ({
    editor: editor.current,
    state: state,
    view: view
  }), [editor, container, state, view]);
  var setEditorRef = useCallback(el => {
    editor.current = el;
    setContainer(el);
  }, [setContainer]);

  // check type of value
  if (typeof value !== 'string') {
    throw new Error("value must be typeof string but got " + typeof value);
  }
  var defaultClassNames = typeof theme === 'string' ? "cm-theme-" + theme : 'cm-theme';
  return /*#__PURE__*/_jsx("div", _extends({
    ref: setEditorRef,
    className: "" + defaultClassNames + (className ? " " + className : '')
  }, other));
});
ReactCodeMirror.displayName = 'CodeMirror';
export default ReactCodeMirror;