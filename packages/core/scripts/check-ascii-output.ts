import fs from 'node:fs';
import path from 'node:path';
import * as babel from '@babel/core';

/**
 * V8 stores a script source at one byte per character only when every character is Latin-1
 * (U+0000-U+00FF). One wider character makes the whole script two bytes per character, which
 * on Cloudflare Workers (128 MB per isolate) costs several MiB for a bundled agent.
 */
const LATIN1_MAX = 0xff;

export interface NonLatin1Character {
  line: number;
  column: number;
  codePoint: number;
}

/**
 * Characters above Latin-1 in executable code: strings, templates, regular expressions and
 * identifiers. Comments are skipped: every minifier removes them, and a Worker is only one byte
 * per character after minification anyway, because inlined third-party code keeps comments with
 * such characters in an unminified bundle.
 */
export function findNonLatin1InCode(code: string, fileName: string): NonLatin1Character[] {
  if (!hasNonLatin1(code)) return [];

  const ast = babel.parseSync(code, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    sourceType: 'unambiguous',
  });
  const comments = (ast?.comments ?? []).map(comment => [comment.start!, comment.end!] as const);

  const found: NonLatin1Character[] = [];
  let line = 1;
  let lineStart = 0;
  let nextComment = 0;
  for (let index = 0; index < code.length; index++) {
    const codePoint = code.codePointAt(index)!;
    const start = index;
    if (codePoint === 0x0a) {
      line++;
      lineStart = index + 1;
    }
    if (codePoint > 0xffff) index++;
    if (codePoint <= LATIN1_MAX) continue;

    while (nextComment < comments.length && comments[nextComment]![1] <= start) nextComment++;
    const comment = comments[nextComment];
    if (comment && comment[0] <= start) continue;

    found.push({ line, column: start - lineStart + 1, codePoint });
  }
  return found;
}

/** Every emitted `.js`, `.cjs` and `.mjs` file under `distDir`, as `file:line:column U+XXXX` lines. */
export function findNonLatin1InDist(distDir: string): string[] {
  const problems: string[] = [];
  for (const entry of fs.readdirSync(distDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.[cm]?js$/.test(entry.name)) continue;
    const file = path.join(entry.parentPath, entry.name);
    for (const { line, column, codePoint } of findNonLatin1InCode(fs.readFileSync(file, 'utf-8'), file)) {
      const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
      problems.push(
        `${path.relative(distDir, file)}:${line}:${column} U+${hex} ${JSON.stringify(String.fromCodePoint(codePoint))}`,
      );
    }
  }
  return problems;
}

function hasNonLatin1(code: string): boolean {
  return /[^\u0000-\u00ff]/.test(code);
}
