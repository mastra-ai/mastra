/**
 * Agent code lenses: types for the action row rendered above symbols that
 * pre-fills the send-to-agent composer with the symbol's source and a task.
 * The Pierre surface renders entries via its annotation gutter.
 */

export type CodeLensAction = 'explain' | 'refactor' | 'tests';

export interface CodeLensEntry {
  /** 1-indexed line the symbol starts on. */
  line: number;
  /** 1-indexed line the symbol ends on. */
  endLine: number;
  name: string;
  kind: string;
}

export type CodeLensActionHandler = (action: CodeLensAction, entry: CodeLensEntry) => void;
