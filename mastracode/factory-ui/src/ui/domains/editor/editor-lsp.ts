/**
 * LSP-backed editor intelligence: hover tooltips and position reporting for
 * go-to commands. The heavy lifting happens server-side (language servers run
 * next to the session workdir); this module only shuttles positions and
 * renders results.
 */

import { linter, lintGutter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { hoverTooltip } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { Extension, Text } from '@codemirror/state';

import type { EditorLspDiagnostic, EditorLspQueryKind, EditorLspResponse } from '../../../api/types';

import { fenceLanguagePath, highlightInto } from './editor-highlight';

export interface EditorLspRequest {
  path: string;
  /** 1-indexed. */
  line: number;
  /** 1-indexed. */
  character: number;
  kind: EditorLspQueryKind;
  content: string;
}

export type EditorLspQueryFn = (input: EditorLspRequest) => Promise<EditorLspResponse | null>;

/** 1-indexed line/character for a document offset. */
export function positionAt(view: EditorView, pos: number): { line: number; character: number } {
  const line = view.state.doc.lineAt(pos);
  return { line: line.number, character: pos - line.from + 1 };
}

/**
 * Render an LSP hover payload (markdown-ish: fenced code + prose) into a
 * tooltip DOM node. We deliberately avoid a markdown renderer here — hover
 * bodies are 95% code fences, and `textContent` assignment keeps it XSS-safe.
 */
function renderHover(value: string, filePath: string): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-lsp-hover';
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const appendProse = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const p = document.createElement('div');
    p.className = 'cm-lsp-hover-prose';
    p.textContent = trimmed;
    dom.appendChild(p);
  };
  while ((match = fence.exec(value)) !== null) {
    appendProse(value.slice(lastIndex, match.index));
    const code = document.createElement('pre');
    code.className = 'cm-lsp-hover-code';
    const snippet = (match[2] ?? '').trimEnd();
    // Plain text first so the tooltip renders instantly; highlighted spans
    // swap in once the (cached) language parser resolves.
    code.textContent = snippet;
    void highlightInto(code, snippet, fenceLanguagePath(match[1] ?? '', filePath));
    dom.appendChild(code);
    lastIndex = match.index + match[0].length;
  }
  appendProse(value.slice(lastIndex));
  return dom;
}

/**
 * Hover tooltip extension: after a short dwell the extension asks the server
 * for hover info at the pointer position and shows type signature + docs.
 * `getPath` is read per-request so one mounted editor follows tab switches.
 */
/** Clamp a 1-indexed LSP range into CodeMirror document offsets. */
function toCmDiagnostic(doc: Text, diagnostic: EditorLspDiagnostic): Diagnostic | null {
  if (diagnostic.line < 1 || diagnostic.line > doc.lines) return null;
  const startLine = doc.line(diagnostic.line);
  const from = Math.min(startLine.from + Math.max(0, diagnostic.character - 1), startLine.to);
  const endLineNumber = Math.min(Math.max(diagnostic.endLine, diagnostic.line), doc.lines);
  const endLine = doc.line(endLineNumber);
  let to = Math.min(endLine.from + Math.max(0, diagnostic.endCharacter - 1), endLine.to);
  // Zero-width ranges render nothing — pad to one character (or the line end).
  if (to <= from) to = Math.min(from + 1, doc.length);
  return {
    from,
    to: Math.max(to, from),
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.source ? { source: diagnostic.source } : {}),
  };
}

/**
 * Server-backed lint pass: after edits settle, ship the buffer to the language
 * server and render its diagnostics (type errors, unused vars…) as squiggles
 * plus gutter markers. Both callbacks are read per-run so one mounted editor
 * follows tab switches, and a run whose file changed mid-flight is discarded.
 */
export function lspLintExtension(getQuery: () => EditorLspQueryFn | null, getPath: () => string): Extension {
  return [
    lintGutter(),
    linter(
      async view => {
        const query = getQuery();
        const path = getPath();
        // Absolute paths are read-only library files — no linting there.
        if (!query || !path || path.startsWith('/')) return [];
        const response = await query({
          path,
          line: 1,
          character: 1,
          kind: 'diagnostics',
          content: view.state.doc.toString(),
        });
        if (getPath() !== path) return [];
        if (!response?.available || !response.diagnostics) return [];
        return response.diagnostics
          .map(diagnostic => toCmDiagnostic(view.state.doc, diagnostic))
          .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== null);
      },
      { delay: 750 },
    ),
  ];
}

export function lspHoverExtension(query: EditorLspQueryFn, getPath: () => string): Extension {
  return hoverTooltip(
    async (view, pos) => {
      const path = getPath();
      if (!path) return null;
      const { line, character } = positionAt(view, pos);
      const response = await query({
        path,
        line,
        character,
        kind: 'hover',
        content: view.state.doc.toString(),
      });
      const value = response?.hover?.value?.trim();
      if (!value) return null;
      const word = view.state.wordAt(pos);
      return {
        pos: word?.from ?? pos,
        end: word?.to ?? pos,
        above: true,
        create: () => ({ dom: renderHover(value, path) }),
      };
    },
    { hoverTime: 350 },
  );
}
