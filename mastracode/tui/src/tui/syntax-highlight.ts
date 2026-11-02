/**
 * Terminal syntax highlighting on highlight.js core.
 *
 * `cli-highlight` loads every highlight.js language (192 files) and parse5 up front, about 23 MB per
 * session. This registers a language (and the languages it embeds) the first time a file of that kind
 * is shown, and colors highlight.js's HTML with the same rules cli-highlight used, so previews look
 * the same.
 */

import { createRequire } from 'node:module';
import chalk from 'chalk';
import type HighlightJs from 'highlight.js';
import { theme } from './theme.js';

const require = createRequire(import.meta.url);

type HLJSApi = typeof HighlightJs;
type LanguageFn = Parameters<HLJSApi['registerLanguage']>[1];

/** highlight.js scope (the word after `hljs-`) → colorizer. */
export type HighlightTheme = Record<string, (text: string) => string>;

/**
 * Syntax roles mapped onto the theme's semantic colors. theme.fg resolves the
 * active theme lazily and contrast-adapts, so code previews recolor with
 * custom themes and stay readable on any background.
 */
export const CODE_HIGHLIGHT_THEME: HighlightTheme = {
  default: text => theme.fg('toolArgs', text),
  keyword: text => theme.fg('textHighlight', text),
  built_in: text => theme.fg('function', text),
  type: text => theme.fg('function', text),
  literal: text => theme.fg('error', text),
  number: text => theme.fg('number', text),
  string: text => theme.fg('success', text),
  regexp: text => theme.fg('error', text),
  title: text => theme.fg('function', text),
  function: text => theme.fg('function', text),
  params: text => theme.fg('secondary', text),
  comment: text => theme.fg('muted', text),
  meta: text => theme.fg('muted', text),
  attr: text => theme.fg('number', text),
  variable: text => theme.fg('secondary', text),
  tag: text => theme.fg('textHighlight', text),
  name: text => theme.fg('textHighlight', text),
};

const plain = (text: string) => text;

/** cli-highlight's DEFAULT_THEME: what a scope gets when the theme above doesn't name it. */
const FALLBACK_THEME: HighlightTheme = {
  keyword: chalk.blue,
  built_in: chalk.cyan,
  type: chalk.cyan.dim,
  literal: chalk.blue,
  number: chalk.green,
  regexp: chalk.red,
  string: chalk.red,
  class: chalk.blue,
  function: chalk.yellow,
  comment: chalk.green,
  doctag: chalk.green,
  meta: chalk.grey,
  tag: chalk.grey,
  name: chalk.blue,
  attr: chalk.cyan,
  emphasis: chalk.italic,
  strong: chalk.bold,
  link: chalk.underline,
  addition: chalk.green,
  deletion: chalk.red,
};

let hljs: HLJSApi | undefined;

function getHljs(): HLJSApi {
  hljs ??= require('highlight.js/lib/core') as HLJSApi;
  return hljs;
}

/** Names highlight.js only knows as an alias of another language's file. */
const LANGUAGE_FILES: Record<string, string> = { html: 'xml' };

/** Languages a grammar hands parts of the code to (`<script>` in HTML, `RUN` in a Dockerfile). */
function subLanguagesOf(language: object): string[] {
  const found = new Set<string>();
  const seen = new Set<object>();
  const visit = (mode: unknown) => {
    if (!mode || typeof mode !== 'object' || seen.has(mode)) return;
    seen.add(mode);
    const { subLanguage, contains, variants, starts } = mode as Record<string, unknown>;
    for (const name of [subLanguage].flat()) if (typeof name === 'string') found.add(name);
    for (const child of [contains, variants].flat()) visit(child);
    visit(starts);
  };
  visit(language);
  return [...found];
}

/**
 * Register a language on first use, along with the languages it embeds, so they highlight as they
 * did when every language was loaded. False when highlight.js has no such language.
 */
function ensureLanguage(language: string): boolean {
  const core = getHljs();
  if (core.getLanguage(language)) return true;
  const file = LANGUAGE_FILES[language] ?? language;
  try {
    core.registerLanguage(file, require(`highlight.js/lib/languages/${file}`) as LanguageFn);
  } catch {
    return false;
  }
  const registered = core.getLanguage(language);
  if (!registered) return false;
  for (const embedded of subLanguagesOf(registered)) ensureLanguage(embedded);
  return true;
}

type HtmlNode = string | { className: string; children: HtmlNode[] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" };

/** Parse highlight.js output, which only ever contains `<span class="…">` and escaped text. */
function parseHighlightHtml(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: HtmlNode[][] = [root];
  for (const match of html.matchAll(/<span class="([^"]*)">|<\/span>|&(amp|lt|gt|quot|#x27|#39);|[^<&]+|[<&]/g)) {
    const children = stack[stack.length - 1]!;
    if (match[1] !== undefined) {
      const span = { className: match[1], children: [] };
      children.push(span);
      stack.push(span.children);
    } else if (match[0] === '</span>') {
      if (stack.length > 1) stack.pop();
    } else {
      // One text node per run, entities included, as an HTML parser would produce.
      const text = match[2] ? ENTITIES[match[2]]! : match[0];
      const last = children.length - 1;
      if (typeof children[last] === 'string') children[last] += text;
      else children.push(text);
    }
  }
  return root;
}

/**
 * cli-highlight's colorizer: text outside any scope takes `default`; a scope colors everything
 * inside it (inner scopes keep their own color); an embedded language's wrapper (`<span
 * class="javascript">`) starts over as if at the top level.
 */
function colorize(node: HtmlNode, colors: HighlightTheme, insideScope: boolean): string {
  if (typeof node === 'string') return insideScope ? node : (colors.default ?? plain)(node);
  const token = /hljs-(\w+)/.exec(node.className)?.[1];
  if (!token) return node.children.map(child => colorize(child, colors, false)).join('');
  const text = node.children.map(child => colorize(child, colors, true)).join('');
  return (colors[token] ?? FALLBACK_THEME[token] ?? plain)(text);
}

/**
 * Highlight `code` as `language`. Unknown or missing languages come back in the theme's default
 * color (no auto-detection, which would need every language loaded).
 */
export function highlightCode(code: string, language: string | undefined, colors = CODE_HIGHLIGHT_THEME): string {
  if (!language || !ensureLanguage(language)) return (colors.default ?? plain)(code);
  const html = getHljs().highlight(code, { language, ignoreIllegals: true }).value;
  return parseHighlightHtml(html)
    .map(node => colorize(node, colors, false))
    .join('');
}
