import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';

function legacy(parser: Parameters<typeof StreamLanguage.define>[0]) {
  return new LanguageSupport(StreamLanguage.define(parser));
}

/**
 * A minimal subset of CodeMirror language descriptions used for fenced code
 * blocks inside markdown. Mirrors the relevant entries from
 * `@codemirror/language-data` but only the languages we actually support, so
 * bundlers don't have to emit a chunk for every known language.
 */
export const codeLanguages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['ecmascript', 'js', 'node'],
    extensions: ['js', 'mjs', 'cjs'],
    load() {
      return import('@codemirror/lang-javascript').then(m => m.javascript());
    },
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['json5'],
    extensions: ['json', 'map'],
    load() {
      return import('@codemirror/lang-json').then(m => m.json());
    },
  }),
  LanguageDescription.of({
    name: 'JSX',
    extensions: ['jsx'],
    load() {
      return import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true }));
    },
  }),
  LanguageDescription.of({
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mkd'],
    load() {
      return import('@codemirror/lang-markdown').then(m => m.markdown());
    },
  }),
  LanguageDescription.of({
    name: 'TSX',
    extensions: ['tsx'],
    load() {
      return import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true }));
    },
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts'],
    extensions: ['ts', 'mts', 'cts'],
    load() {
      return import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true }));
    },
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['bash', 'sh', 'zsh'],
    extensions: ['sh', 'ksh', 'bash'],
    filename: /^PKGBUILD$/,
    load() {
      return import('@codemirror/legacy-modes/mode/shell').then(m => legacy(m.shell));
    },
  }),
];
