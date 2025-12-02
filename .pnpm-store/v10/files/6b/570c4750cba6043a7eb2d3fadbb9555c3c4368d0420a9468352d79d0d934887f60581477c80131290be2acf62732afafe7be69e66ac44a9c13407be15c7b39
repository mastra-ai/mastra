import MagicString from 'magic-string';

import { findStaticImports } from 'mlly';

import { ESMShim, CJSyntaxRegex } from './constants';
import type { Output } from './types';

// Shim __dirname, __filename and require
export function provideCJSSyntax(code: string): Output | null {
  if (code.includes(ESMShim) || !CJSyntaxRegex.test(code)) {
    return null;
  }

  const lastESMImport = findStaticImports(code).pop();
  const indexToAppend = lastESMImport ? lastESMImport.end : 0;
  const s = new MagicString(code);
  s.appendRight(indexToAppend, ESMShim);

  const sourceMap = s.generateMap({
    includeContent: true
  });
  let sourcesContent: string[] | undefined;
  if (Array.isArray(sourceMap.sourcesContent)) {
    sourcesContent = [];
    for (let i = 0; i < sourceMap.sourcesContent.length; i++) {
      const content = sourceMap.sourcesContent[i];
      if (typeof content === 'string') {
        sourcesContent.push(content);
      }
    }
  }

  return {
    code: s.toString(),
    map: {
      ...sourceMap,
      sourcesContent
    }
  };
}
