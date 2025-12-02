import { useEffect, useLayoutEffect, useState } from 'react';
import { Annotation, EditorState, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { getDefaultExtensions } from "./getDefaultExtensions.js";
import { getStatistics } from "./utils.js";
import { TimeoutLatch, getScheduler } from "./timeoutLatch.js";
export var ExternalChange = Annotation.define();
var TYPING_TIMOUT = 200; // ms

var emptyExtensions = [];
export function useCodeMirror(props) {
  var {
    value,
    selection,
    onChange,
    onStatistics,
    onCreateEditor,
    onUpdate,
    extensions = emptyExtensions,
    autoFocus,
    theme = 'light',
    height = null,
    minHeight = null,
    maxHeight = null,
    width = null,
    minWidth = null,
    maxWidth = null,
    placeholder: placeholderStr = '',
    editable = true,
    readOnly = false,
    indentWithTab: defaultIndentWithTab = true,
    basicSetup: defaultBasicSetup = true,
    root,
    initialState
  } = props;
  var [container, setContainer] = useState();
  var [view, setView] = useState();
  var [state, setState] = useState();
  var typingLatch = useState(() => ({
    current: null
  }))[0];
  var pendingUpdate = useState(() => ({
    current: null
  }))[0];
  var defaultThemeOption = EditorView.theme({
    '&': {
      height,
      minHeight,
      maxHeight,
      width,
      minWidth,
      maxWidth
    },
    '& .cm-scroller': {
      height: '100% !important'
    }
  });
  var updateListener = EditorView.updateListener.of(vu => {
    if (vu.docChanged && typeof onChange === 'function' &&
    // Fix echoing of the remote changes:
    // If transaction is market as remote we don't have to call `onChange` handler again
    !vu.transactions.some(tr => tr.annotation(ExternalChange))) {
      if (typingLatch.current) {
        typingLatch.current.reset();
      } else {
        typingLatch.current = new TimeoutLatch(() => {
          if (pendingUpdate.current) {
            var forceUpdate = pendingUpdate.current;
            pendingUpdate.current = null;
            forceUpdate();
          }
          typingLatch.current = null;
        }, TYPING_TIMOUT);
        getScheduler().add(typingLatch.current);
      }
      var doc = vu.state.doc;
      var _value = doc.toString();
      onChange(_value, vu);
    }
    onStatistics && onStatistics(getStatistics(vu));
  });
  var defaultExtensions = getDefaultExtensions({
    theme,
    editable,
    readOnly,
    placeholder: placeholderStr,
    indentWithTab: defaultIndentWithTab,
    basicSetup: defaultBasicSetup
  });
  var getExtensions = [updateListener, defaultThemeOption, ...defaultExtensions];
  if (onUpdate && typeof onUpdate === 'function') {
    getExtensions.push(EditorView.updateListener.of(onUpdate));
  }
  getExtensions = getExtensions.concat(extensions);
  useLayoutEffect(() => {
    if (container && !state) {
      var config = {
        doc: value,
        selection,
        extensions: getExtensions
      };
      var stateCurrent = initialState ? EditorState.fromJSON(initialState.json, config, initialState.fields) : EditorState.create(config);
      setState(stateCurrent);
      if (!view) {
        var viewCurrent = new EditorView({
          state: stateCurrent,
          parent: container,
          root
        });
        setView(viewCurrent);
        onCreateEditor && onCreateEditor(viewCurrent, stateCurrent);
      }
    }
    return () => {
      if (view) {
        setState(undefined);
        setView(undefined);
      }
    };
  }, [container, state]);
  useEffect(() => {
    if (props.container) {
      setContainer(props.container);
    }
  }, [props.container]);
  useEffect(() => () => {
    if (view) {
      view.destroy();
      setView(undefined);
    }
    if (typingLatch.current) {
      typingLatch.current.cancel();
      typingLatch.current = null;
    }
  }, [view]);
  useEffect(() => {
    if (autoFocus && view) {
      view.focus();
    }
  }, [autoFocus, view]);
  useEffect(() => {
    if (view) {
      view.dispatch({
        effects: StateEffect.reconfigure.of(getExtensions)
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, extensions, height, minHeight, maxHeight, width, minWidth, maxWidth, placeholderStr, editable, readOnly, defaultIndentWithTab, defaultBasicSetup, onChange, onUpdate]);
  useEffect(() => {
    if (value === undefined) {
      return;
    }
    var currentValue = view ? view.state.doc.toString() : '';
    if (view && value !== currentValue) {
      var isTyping = typingLatch.current && !typingLatch.current.isDone;
      var forceUpdate = () => {
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
    state,
    setState,
    view,
    setView,
    container,
    setContainer
  };
}