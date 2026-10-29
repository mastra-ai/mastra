import type { StreamParser } from '@codemirror/language';
import { TreeFragment } from '@lezer/common';
import type { Parser, Tree } from '@lezer/common';
import { highlightTree, tagHighlighter, tags as t } from '@lezer/highlight';

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
const langAliases: Record<string, Lang> = {
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
};

async function streamParser(mode: Promise<StreamParser<unknown>>): Promise<Parser> {
  const [{ StreamLanguage }, parser] = await Promise.all([import('@codemirror/language'), mode]);
  return StreamLanguage.define(parser).parser;
}

async function jsParser(options: { jsx?: boolean; typescript?: boolean }): Promise<Parser> {
  const { javascript } = await import('@codemirror/lang-javascript');
  return javascript(options).language.parser;
}

// Dynamic imports keep each grammar in its own lazily-loaded chunk.
const loaders = {
  javascript: () => jsParser({}),
  jsx: () => jsParser({ jsx: true }),
  typescript: () => jsParser({ typescript: true }),
  tsx: () => jsParser({ jsx: true, typescript: true }),
  json: () => import('@codemirror/lang-json').then(m => m.jsonLanguage.parser),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdownLanguage.parser),
  bash: () => streamParser(import('@codemirror/legacy-modes/mode/shell').then(m => m.shell)),
  python: () => streamParser(import('@codemirror/legacy-modes/mode/python').then(m => m.python)),
  yaml: () => streamParser(import('@codemirror/legacy-modes/mode/yaml').then(m => m.yaml)),
  diff: () => streamParser(import('@codemirror/legacy-modes/mode/diff').then(m => m.diff)),
  css: () => streamParser(import('@codemirror/legacy-modes/mode/css').then(m => m.css)),
  html: () => streamParser(import('@codemirror/legacy-modes/mode/xml').then(m => m.html)),
  xml: () => streamParser(import('@codemirror/legacy-modes/mode/xml').then(m => m.xml)),
  sql: () => streamParser(import('@codemirror/legacy-modes/mode/sql').then(m => m.standardSQL)),
} satisfies Record<string, () => Promise<Parser>>;

type Lang = keyof typeof loaders;

const parsers = new Map<Lang, Promise<Parser>>();

function getParser(lang: Lang): Promise<Parser> {
  let parser = parsers.get(lang);
  if (!parser) {
    parser = loaders[lang]();
    // Let a failed chunk load be retried on the next highlight pass.
    parser.catch(() => parsers.delete(lang));
    parsers.set(lang, parser);
  }
  return parser;
}

/**
 * Maps Lezer highlight tags to role classes styled in `components.css`. Both the
 * read-only `<Code>` viewer and every CodeMirror editor (`useCodemirrorTheme`)
 * use it, so they share one palette (`--syntax-*`).
 */
export const syntaxHighlighter = tagHighlighter([
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
]);

/** Lets Lezer reuse the previous tree when `code` only appends to it, as a streaming fence does. */
function reusableFragments(code: string, previous: HighlightResult | undefined) {
  if (!previous || !code.startsWith(previous.code)) return undefined;
  const end = previous.code.length;
  return TreeFragment.applyChanges(TreeFragment.addTree(previous.tree), [
    { fromA: end, toA: end, fromB: end, toB: code.length },
  ]);
}

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
  const lang = langAliases[language?.toLowerCase()];
  if (!lang) return null;

  const parser = await getParser(lang);
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

export function languageForPath(path: string | undefined): string | undefined {
  const extension = path?.split('.').pop()?.toLowerCase();
  return extension ? langAliases[extension] : undefined;
}
