import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVER_DIR = join(__dirname, '..');

// A2A errors travel inside the JSON-RPC envelope and agent-controller returns
// business results ({ ok: false, reason }), so neither uses the problem format.
const EXCLUDED = [/(^|\/)a2a[^/]*\.ts$/, /(^|\/)agent-controller[^/]*\.ts$/];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts') || entry.name.includes('.test.')) return [];
    return [path];
  });
}

function extractCall(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '(') depth++;
    if (source[i] === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function findHttpExceptionsWithoutCode() {
  const offenders: string[] = [];
  const files = [
    ...listSourceFiles(join(SERVER_DIR, 'handlers')),
    ...listSourceFiles(join(SERVER_DIR, 'server-adapter')),
    join(SERVER_DIR, 'utils.ts'),
  ];

  for (const file of files) {
    const rel = relative(SERVER_DIR, file);
    if (EXCLUDED.some(pattern => pattern.test(rel))) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/new HTTPException\(/g)) {
      const call = extractCall(source, match.index! + 'new HTTPException'.length);
      if (/\bcode\s*[:,}]/.test(call)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${rel}:${line} ${call.replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }
  return offenders;
}

describe('business error code coverage', () => {
  it('every HTTPException thrown by a server route carries a business code', () => {
    expect(findHttpExceptionsWithoutCode()).toEqual([]);
  });

  it('business codes are referenced through MASTRA_ERROR_CODES, never as string literals', () => {
    const literals: string[] = [];
    for (const file of [...listSourceFiles(join(SERVER_DIR, 'handlers')), join(SERVER_DIR, 'utils.ts')]) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/new HTTPException\(/g)) {
        const call = extractCall(source, match.index! + 'new HTTPException'.length);
        if (/\bcode:\s*['"`]/.test(call)) {
          literals.push(`${relative(SERVER_DIR, file)}:${source.slice(0, match.index).split('\n').length}`);
        }
      }
    }
    expect(literals).toEqual([]);
  });
});
