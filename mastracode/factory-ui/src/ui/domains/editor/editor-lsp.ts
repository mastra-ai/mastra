/**
 * LSP-backed editor intelligence: request/response types shared by the editor
 * surface, diagnostics polling, and hover. The heavy lifting happens
 * server-side (language servers run next to the session workdir); the client
 * only shuttles positions and renders results.
 */

import type { EditorLspQueryKind, EditorLspResponse } from '../../../api/types';

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
