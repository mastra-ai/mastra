import { useEffect, useLayoutEffect, useState } from 'react';
import { Annotation, EditorState, StateEffect, type Extension } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { getDefaultExtensions } from './getDefaultExtensions';
import { getStatistics } from './utils';
import { type ReactCodeMirrorProps } from '.';
import { TimeoutLatch, getScheduler } from './timeoutLatch';

export const ExternalChange = Annotation.define<boolean>();
const TYPING_TIMOUT = 200; // ms

export interface UseCodeMirror extends ReactCodeMirrorProps {
  container?: HTMLDivElement | null;
}

const emptyExtensions: Extension[] = [];

export function useCodeMirror(props: UseCodeMirror) {
  const {
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
    initialState,
  } = props;
  const [container, setContainer] = useState<HTMLDivElement | null>();
  const [view, setView] = useState<EditorView>();
  const [state, setState] = useState<EditorState>();
  const typingLatch = useState<{ current: TimeoutLatch | null }>(() => ({ current: null }))[0];
  const pendingUpdate = useState<{ current: (() => void) | null }>(() => ({ current: null }))[0];
  const defaultThemeOption = EditorView.theme({
    '&': {
      height,
      minHeight,
      maxHeight,
      width,
      minWidth,
      maxWidth,
    },
    '& .cm-scroller': {
      height: '100% !important',
    },
  });
  const updateListener = EditorView.updateListener.of((vu: ViewUpdate) => {
    if (
      vu.docChanged &&
      typeof onChange === 'function' &&
      // Fix echoing of the remote changes:
      // If transaction is market as remote we don't have to call `onChange` handler again
      !vu.transactions.some((tr) => tr.annotation(ExternalChange))
    ) {
      if (typingLatch.current) {
        typingLatch.current.reset();
      } else {
        typingLatch.current = new TimeoutLatch(() => {
          if (pendingUpdate.current) {
            const forceUpdate = pendingUpdate.current;
            pendingUpdate.current = null;
            forceUpdate();
          }
          typingLatch.current = null;
        }, TYPING_TIMOUT);
        getScheduler().add(typingLatch.current);
      }

      const doc = vu.state.doc;
      const value = doc.toString();
      onChange(value, vu);
    }
    onStatistics && onStatistics(getStatistics(vu));
  });

  const defaultExtensions = getDefaultExtensions({
    theme,
    editable,
    readOnly,
    placeholder: placeholderStr,
    indentWithTab: defaultIndentWithTab,
    basicSetup: defaultBasicSetup,
  });

  let getExtensions = [updateListener, defaultThemeOption, ...defaultExtensions];

  if (onUpdate && typeof onUpdate === 'function') {
    getExtensions.push(EditorView.updateListener.of(onUpdate));
  }
  getExtensions = getExtensions.concat(extensions);

  useLayoutEffect(() => {
    if (container && !state) {
      const config = {
        doc: value,
        selection,
        extensions: getExtensions,
      };
      const stateCurrent = initialState
        ? EditorState.fromJSON(initialState.json, config, initialState.fields)
        : EditorState.create(config);
      setState(stateCurrent);
      if (!view) {
        const viewCurrent = new EditorView({
          state: stateCurrent,
          parent: container,
          root,
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

  useEffect(
    () => () => {
      if (view) {
        view.destroy();
        setView(undefined);
      }
      if (typingLatch.current) {
        typingLatch.current.cancel();
        typingLatch.current = null;
      }
    },
    [view],
  );

  useEffect(() => {
    if (autoFocus && view) {
      view.focus();
    }
  }, [autoFocus, view]);

  useEffect(() => {
    if (view) {
      view.dispatch({ effects: StateEffect.reconfigure.of(getExtensions) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    extensions,
    height,
    minHeight,
    maxHeight,
    width,
    minWidth,
    maxWidth,
    placeholderStr,
    editable,
    readOnly,
    defaultIndentWithTab,
    defaultBasicSetup,
    onChange,
    onUpdate,
  ]);

  useEffect(() => {
    if (value === undefined) {
      return;
    }
    const currentValue = view ? view.state.doc.toString() : '';
    if (view && value !== currentValue) {
      const isTyping = typingLatch.current && !typingLatch.current.isDone;

      const forceUpdate = () => {
        if (view && value !== view.state.doc.toString()) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.toString().length, insert: value || '' },
            annotations: [ExternalChange.of(true)],
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

  return { state, setState, view, setView, container, setContainer };
}
