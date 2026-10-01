import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** 1-indexed selection payload for the send-to-agent bar. */
export interface SurfaceSelectionPayload {
  startLine: number;
  endLine: number;
  snippet: string;
}

interface SelectionPosition {
  line: number;
  character: number;
}

/**
 * The slice of Pierre's `Editor` the selection tracker reads — structural so
 * both `Editor<'file'>` and `Editor<'file-diff'>` satisfy it.
 */
export interface SelectionEditorLike {
  getViewState():
    | { selections?: { start: SelectionPosition; end: SelectionPosition }[] | undefined }
    | null
    | undefined;
  getEditState():
    | { document?: { offsetAt(position: SelectionPosition): number; getText(): string } | undefined }
    | null
    | undefined;
}

/**
 * Selection tracking for the send-to-agent bar + cursor-line breadcrumbs,
 * shared by the file and diff surfaces. Pierre has no selection-change
 * callback, so this listens to the document's `selectionchange` (fires for
 * the shadow contenteditable too) and reads the editor's view state. Dedupe
 * so a payload only fires when it changes.
 *
 * Emission is deferred until the selection SETTLES: never mid pointer-drag,
 * and only after a short pause for keyboard selection. The send bar
 * autofocuses its textarea on mount — emitting while the user is still
 * extending the selection would yank focus out of the contenteditable and
 * break the drag / shift-arrow sequence.
 */
export function useSurfaceSelection({
  containerRef,
  getEditor,
  onSelectionChange,
  onCursorLineChange,
  externalSelection,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  getEditor: () => SelectionEditorLike | null;
  onSelectionChange?: (payload: SurfaceSelectionPayload | null) => void;
  onCursorLineChange?: (line: number) => void;
  /**
   * The externally-owned selection this surface renders (the pending
   * send-bar selection). When the owner clears it — bar dismissed or prompt
   * sent — the dedupe cache resets so re-selecting the same range re-emits
   * and re-opens the bar.
   */
  externalSelection?: unknown;
}) {
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onCursorLineRef = useRef(onCursorLineChange);
  const getEditorRef = useRef(getEditor);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onCursorLineRef.current = onCursorLineChange;
    getEditorRef.current = getEditor;
  }, [onSelectionChange, onCursorLineChange, getEditor]);

  const cursorLineRef = useRef<number | null>(null);
  const lastSelectionRef = useRef<string>('null');

  useEffect(() => {
    if (externalSelection == null) lastSelectionRef.current = 'null';
  }, [externalSelection]);

  useEffect(() => {
    let timer: number | null = null;
    let dragging = false;
    const emit = () => {
      const editor = getEditorRef.current();
      const node = containerRef.current;
      if (!editor || !node) return;
      // Only track while the selection lives inside this surface — the
      // shadow host retargets `document.activeElement` to an ancestor of the
      // container, so containment is checkable from the light DOM.
      const active = document.activeElement;
      if (!active || !node.contains(active)) return;
      const selection = editor.getViewState()?.selections?.[0];
      if (!selection) return;
      const selectionFn = onSelectionChangeRef.current;
      if (!selectionFn) return;
      const doc = editor.getEditState()?.document;
      if (!doc) return;
      const anchorOffset = doc.offsetAt(selection.start);
      const headOffset = doc.offsetAt(selection.end);
      let payload: SurfaceSelectionPayload | null = null;
      if (anchorOffset !== headOffset) {
        const from = Math.min(anchorOffset, headOffset);
        const to = Math.max(anchorOffset, headOffset);
        const startLine = Math.min(selection.start.line, selection.end.line) + 1;
        const endLine = Math.max(selection.start.line, selection.end.line) + 1;
        payload = { startLine, endLine, snippet: doc.getText().slice(from, to) };
      }
      const key = JSON.stringify(payload);
      if (key === lastSelectionRef.current) return;
      lastSelectionRef.current = key;
      selectionFn(payload);
    };
    const schedule = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (!dragging) emit();
      }, 300);
    };
    const handler = () => {
      const editor = getEditorRef.current();
      const node = containerRef.current;
      if (!editor || !node) return;
      const active = document.activeElement;
      if (!active || !node.contains(active)) return;
      const selection = editor.getViewState()?.selections?.[0];
      if (!selection) return;
      // Cursor-line breadcrumbs stay immediate; only the bar payload settles.
      const line = selection.end.line + 1;
      if (cursorLineRef.current !== line) {
        cursorLineRef.current = line;
        onCursorLineRef.current?.(line);
      }
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) dragging = true;
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      schedule();
    };
    const node = containerRef.current;
    document.addEventListener('selectionchange', handler);
    node?.addEventListener('pointerdown', onPointerDown);
    // The drag can end anywhere on the page, so pointerup lives on document.
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('selectionchange', handler);
      node?.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [containerRef]);
}
