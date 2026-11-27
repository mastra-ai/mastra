import type { Language, StreamParser } from '@codemirror/language';
import { TreeFragment } from '@lezer/common';
import type { Tree } from '@lezer/common';
import { highlightTree, tagHighlighter, tags as t } from '@lezer/highlight';
import type { Tag } from '@lezer/highlight';

type SyntaxTagStyle = { tag: Tag | readonly Tag[]; class: string };

export interface HighlightToken {
  content: string;
  className?: string;
}

export interface HighlightResult {
  code: string;
  tokens: HighlightToken[][];
  /** Parse tree for `code`. Pass the result back as `previous` so appended code re-parses only the new tail. */
  tree: Tree;
}

/**
 * Languages we support for syntax highlighting in read-only code blocks. A
 * superset of the editable CodeMirror `codeLanguages` set: read-only blocks
 * (markdown fences, chat output) also carry python, yaml, diff, css, html, xml
 * and sql.
 */
const langAliases = new Map(
  Object.entries({
    js: 'javascript',
    javascript: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    node: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    tsx: 'tsx',
    jsx: 'jsx',
    json: 'json',
    json5: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    python: 'python',
    sh: 'bash',
    bash: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    diff: 'diff',
    patch: 'diff',
    css: 'css',
    scss: 'css',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    sql: 'sql',
  } satisfies Record<string, HighlightLanguage>),
);

async function streamLanguage(mode: Promise<StreamParser<unknown>>): Promise<Language> {
  const [{ StreamLanguage }, parser] = await Promise.all([import('@codemirror/language'), mode]);
  return StreamLanguage.define(parser);
}

async function jsLanguage(options: { jsx?: boolean; typescript?: boolean }): Promise<Language> {
  const { javascript } = await import('@codemirror/lang-javascript');
  return javascript(options).language;
}

// Dynamic imports keep each grammar in its own lazily-loaded chunk.
const loaders = {
  javascript: () => jsLanguage({}),
  jsx: () => jsLanguage({ jsx: true }),
  typescript: () => jsLanguage({ typescript: true }),
  tsx: () => jsLanguage({ jsx: true, typescript: true }),
  json: () => import('@codemirror/lang-json').then(m => m.jsonLanguage),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdownLanguage),
  bash: () => streamLanguage(import('@codemirror/legacy-modes/mode/shell').then(m => m.shell)),
  python: () => streamLanguage(import('@codemirror/legacy-modes/mode/python').then(m => m.python)),
  yaml: () => streamLanguage(import('@codemirror/legacy-modes/mode/yaml').then(m => m.yaml)),
  diff: () => streamLanguage(import('@codemirror/legacy-modes/mode/diff').then(m => m.diff)),
  css: () => streamLanguage(import('@codemirror/legacy-modes/mode/css').then(m => m.css)),
  html: () => streamLanguage(import('@codemirror/legacy-modes/mode/xml').then(m => m.html)),
  xml: () => streamLanguage(import('@codemirror/legacy-modes/mode/xml').then(m => m.xml)),
  sql: () => streamLanguage(import('@codemirror/legacy-modes/mode/sql').then(m => m.standardSQL)),
} satisfies Record<string, () => Promise<Language>>;

export type HighlightLanguage = keyof typeof loaders;

const languages = new Map<HighlightLanguage, Promise<Language>>();

export function loadLanguage(lang: HighlightLanguage): Promise<Language> {
  let language = languages.get(lang);
  if (!language) {
    language = loaders[lang]();
    // Let a failed chunk load be retried on the next highlight pass.
    language.catch(() => languages.delete(lang));
    languages.set(lang, language);
  }
  return language;
}

/**
 * Maps Lezer highlight tags to role classes styled in `components.css`. Both the
 * read-only `<Code>` viewer and every CodeMirror editor (`useCodemirrorTheme`)
 * use it, so they share one palette (`--syntax-*`).
 */
export const syntaxTagStyles: readonly SyntaxTagStyle[] = [
  { tag: [t.comment, t.bracket], class: 'syntax-comment' },
  { tag: [t.string, t.meta, t.regexp, t.name, t.quote, t.standard(t.tagName)], class: 'syntax-string' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], class: 'syntax-literal' },
  { tag: [t.keyword, t.operator, t.tagName, t.deleted], class: 'syntax-keyword' },
  { tag: [t.function(t.propertyName), t.propertyName, t.variableName, t.number], class: 'syntax-name' },
  {
    tag: [t.definition(t.variableName), t.function(t.variableName), t.className, t.attributeName, t.url],
    class: 'syntax-definition',
  },
  { tag: t.link, class: 'syntax-link' },
  { tag: t.heading, class: 'syntax-heading' },
  { tag: t.emphasis, class: 'syntax-emphasis' },
  { tag: t.strong, class: 'syntax-strong' },
  { tag: t.strikethrough, class: 'syntax-strike' },
  { tag: t.invalid, class: 'syntax-invalid' },
];

export const syntaxHighlighter = tagHighlighter(syntaxTagStyles);

/** Lets Lezer reuse the previous tree when `code` only appends to it, as a streaming fence does. */
function reusableFragments(code: string, previous: HighlightResult | undefined) {
  if (!previous || !code.startsWith(previous.code)) return undefined;
  const end = previous.code.length;
  return TreeFragment.applyChanges(TreeFragment.addTree(previous.tree), [
    { fromA: end, toA: end, fromB: end, toB: code.length },
  ]);
}

export const MAX_HIGHLIGHT_LENGTH = 50_000;

/**
 * Tokenizes `code` into lines of tokens. Joining every token's content with
 * `\n` between lines reproduces `code` exactly. Returns `null` for languages
 * without a grammar. `previous` must come from the same language.
 */
export async function highlight(
  code: string,
  language: string,
  previous?: HighlightResult,
): Promise<HighlightResult | null> {
  const lang = langAliases.get(language?.toLowerCase());
  if (!lang || code.length > MAX_HIGHLIGHT_LENGTH) return null;

  const { parser } = await loadLanguage(lang);
  const tree = parser.parse(code, reusableFragments(code, previous));
  let line: HighlightToken[] = [];
  const lines = [line];

  const push = (text: string, className?: string) => {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push((line = []));
      if (part) line.push(className ? { content: part, className } : { content: part });
    });
  };

  let pos = 0;
  highlightTree(tree, syntaxHighlighter, (from, to, className) => {
    if (from > pos) push(code.slice(pos, from));
    push(code.slice(from, to), className);
    pos = to;
  });
  if (pos < code.length) push(code.slice(pos));

  return { code, tokens: lines, tree };
}

export function languageForPath(path: string | undefined): HighlightLanguage | undefined {
  const extension = path?.split('.').pop()?.toLowerCase();
  return extension ? langAliases.get(extension) : undefined;
}
