import { useEffect, useState } from 'react';

import type { EditorLspDiagnostic } from '../../../api/types';
import type { EditorLspQueryFn } from './editor-lsp';

const LINT_DEBOUNCE_MS = 750;

/**
 * Server-backed diagnostics pass for the Pierre editor. Debounces on content
 * changes, discards racing responses when the path or content shifts mid-flight,
 * and returns null for read-only library files.
 */
export function usePierreLspDiagnostics(
  lspQuery: EditorLspQueryFn | null | undefined,
  path: string | null | undefined,
  content: string,
): EditorLspDiagnostic[] | null {
  const [diagnostics, setDiagnostics] = useState<EditorLspDiagnostic[] | null>(null);

  useEffect(() => {
    // Absolute paths are read-only library files — no lint pass runs there.
    if (!lspQuery || !path || path.startsWith('/')) {
      setDiagnostics(null);
      return;
    }
    let disposed = false;
    const currentContent = content;
    const timer = setTimeout(async () => {
      if (disposed) return;
      const response = await lspQuery({ path, line: 1, character: 1, kind: 'diagnostics', content: currentContent });
      if (disposed) return;
      if (!response?.available || !response.diagnostics) {
        setDiagnostics([]);
        return;
      }
      setDiagnostics(response.diagnostics);
    }, LINT_DEBOUNCE_MS);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [lspQuery, path, content]);

  // Reset diagnostics when the path changes so stale markers don't linger.
  useEffect(() => {
    setDiagnostics(null);
  }, [path]);

  return diagnostics;
}
