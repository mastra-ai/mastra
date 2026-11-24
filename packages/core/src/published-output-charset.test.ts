import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findNonLatin1InCode } from '@internal/types-builder/check-ascii-output';
import { Rolldown } from 'tsdown';
import { afterAll, describe, expect, it } from 'vitest';

// A Worker bundling core holds its script source in the V8 heap. V8 stores it at one byte per
// character only if every character is Latin-1; a single wider one doubles the cost (31 -> 24 MiB
// heap for a minified agent Worker). Core builds with rolldown `charset: 'ascii'` and fails the
// build on anything left above U+00FF outside comments. These tests check that the escaping keeps
// behaviour identical and that the build check catches what escaping cannot fix.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'core-charset-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function bundle(name: string, source: string, charset: 'ascii' | 'utf8') {
  const entry = path.join(import.meta.dirname, `__charset-${name}-entry.mjs`);
  fs.writeFileSync(entry, source);
  try {
    const build = await Rolldown.rolldown({ input: entry, logLevel: 'silent' });
    const { output } = await build.generate({ format: 'esm', charset });
    await build.close();
    const code = output[0].code;
    const file = path.join(tmp, `${name}-${charset}.mjs`);
    fs.writeFileSync(file, code);
    return { code, load: () => import(pathToFileURL(file).href) };
  } finally {
    fs.rmSync(entry);
  }
}

const ownPatterns = `
const DIACRITICS = /[̀-ͯ]/g;
export const stripDiacritics = s => s.normalize('NFKD').replace(DIACRITICS, '');
export const german = s => /[äöüßẞ]/i.test(s);
export const emojiRange = s => [...s.matchAll(/[😀-😂]/gu)].map(m => m[0]);
export const emojiNoFlag = s => /^.😀$/.test(s);
export const setDifference = s => /^[\\p{L}--[éè]]+$/v.test(s);
export const café = 'café ∑ 日本語 😀';
export const greeting = (name) => \`Grüß \${name} — ✓\`;
export const sourceOfRegex = /ẞ/.source.length;
`;

const inputs = ['Résumé Zoë', 'Straße', 'STRAẞE', 'a😀', '😀😁😂😃', 'xyz', 'abc', 'abé', '', 'Ålborg ✓ 日本'];

describe('core output escaped to ASCII', () => {
  it('behaves the same for regex classes, unicode and v flags, astral characters, strings and identifiers', async () => {
    const original = await bundle('own', ownPatterns, 'utf8');
    const escaped = await bundle('own', ownPatterns, 'ascii');
    expect(findNonLatin1InCode(original.code, 'own-utf8.mjs').length).toBeGreaterThan(0);
    expect(findNonLatin1InCode(escaped.code, 'own-ascii.mjs')).toEqual([]);

    const a = await original.load();
    const b = await escaped.load();
    for (const fn of ['stripDiacritics', 'german', 'emojiRange', 'emojiNoFlag', 'setDifference', 'greeting']) {
      for (const input of inputs) expect([fn, input, b[fn](input)]).toEqual([fn, input, a[fn](input)]);
    }
    expect(b.café).toBe(a.café);
    // Anchors, so the comparison above can't pass with both sides broken the same way.
    expect(b.stripDiacritics('Résumé Zoë')).toBe('Resume Zoe');
    expect([b.german('STRAẞE'), b.german('xyz')]).toEqual([true, false]);
    expect(b.emojiRange('😀😁😂😃')).toEqual(['😀', '😁', '😂']);
    // Without the u flag `.` matches one UTF-16 unit, so an astral character is two of them.
    expect([b.emojiNoFlag('a😀'), b.emojiNoFlag('😀😀')]).toEqual([true, false]);
    expect([b.setDifference('abc'), b.setDifference('abé')]).toEqual([true, false]);
    // Escaping changes RegExp#source (documented by rolldown); nothing in core reads it.
    expect(a.sourceOfRegex).toBe(1);
    expect(b.sourceOfRegex).toBe(6);
  });

  it('keeps token estimates and slugs from inlined tokenx and slugify identical for non-English text', async () => {
    const source = `export * from 'tokenx';\nexport { default as slugify } from '@sindresorhus/slugify';\n`;
    const original = await bundle('vendor', source, 'utf8');
    const escaped = await bundle('vendor', source, 'ascii');
    // tokenx's language table (/[äöüßẞ]/i) and slugify's replacement map are the third-party
    // characters that kept core's published chunks two-byte.
    expect(findNonLatin1InCode(original.code, 'vendor-utf8.mjs').length).toBeGreaterThan(0);
    expect(findNonLatin1InCode(escaped.code, 'vendor-ascii.mjs')).toEqual([]);

    const a = await original.load();
    const b = await escaped.load();
    const texts = [
      'Die Größe der Äpfel in der Straße — GROẞ',
      'Привет, как дела? Ελληνικά κείμενα',
      '日本語のテキストと한국어 텍스트 😀',
      'Plain English with numbers 12345 and symbols !?',
    ];
    for (const text of texts) {
      expect(b.estimateTokenCount(text)).toBe(a.estimateTokenCount(text));
      expect(b.sliceByTokens(text, 2, 6)).toBe(a.sliceByTokens(text, 2, 6));
      expect(b.slugify(text)).toBe(a.slugify(text));
    }
  });

  it('reports what escaping leaves behind, by line and column, and ignores comments', async () => {
    const escaped = await bundle(
      'leftover',
      `// Grüße — a comment ✓\n/* ẞ block */\nexport const raw = String.raw\`→\`;\n`,
      'ascii',
    );
    // Tagged template text is observable through String.raw, so rolldown leaves it as is.
    const found = findNonLatin1InCode(escaped.code, 'leftover.mjs');
    expect(found).toHaveLength(1);
    expect(found[0]!.codePoint).toBe(0x2192);
    expect(escaped.code.split('\n')[found[0]!.line - 1]!.codePointAt(found[0]!.column - 1)).toBe(0x2192);

    expect(findNonLatin1InCode('const a = 1; /* — */ const b = "日"; // ✓\nconst c = `😀`;', 'x.js')).toEqual([
      { line: 1, column: 33, codePoint: 0x65e5 },
      { line: 2, column: 12, codePoint: 0x1f600 },
    ]);
    // Latin-1 is already stored one byte per character.
    expect(findNonLatin1InCode('const s = "café";', 'x.js')).toEqual([]);
  });
});
