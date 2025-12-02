import type { Plugin, SourceMapInput } from 'rollup';

interface Output {
  code: string;
  map?: SourceMapInput;
}

/**
 * A Rollup plugin to replace cjs syntax for esm output bundles.
 *
 * @returns Plugin instance.
 */
export default function commonjsShim(): Plugin;
export function provideCJSSyntax(code: string): Output | null;
