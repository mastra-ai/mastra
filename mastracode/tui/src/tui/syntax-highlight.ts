/**
 * Terminal syntax highlighting on highlight.js core.
 *
 * `cli-highlight` loads every highlight.js language (192 files) and parse5 up front, about 23 MB per
 * session. This registers one language the first time a file of that kind is shown, and converts
 * highlight.js's `<span class="hljs-…">` output to ANSI with the active theme's colors.
 */

import { createRequire } from 'node:module';
import type HighlightJs from 'highlight.js';
import { theme } from './theme.js';

const require = createRequire(import.meta.url);

type HLJSApi = typeof HighlightJs;
type LanguageFn = Parameters<HLJSApi['registerLanguage']>[1];

/** highlight.js scope (without the `hljs-` prefix) → colorizer. */
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

let hljs: HLJSApi | undefined;

function getHljs(): HLJSApi {
  hljs ??= require('highlight.js/lib/core') as HLJSApi;
  return hljs;
}

/** Names highlight.js only knows as an alias of another language's file. */
const LANGUAGE_FILES: Record<string, string> = { html: 'xml' };

/** Register a language on first use; false when highlight.js has no such language. */
function ensureLanguage(language: string): boolean {
  const core = getHljs();
  if (core.getLanguage(language)) return true;
  const file = LANGUAGE_FILES[language] ?? language;
  try {
    core.registerLanguage(file, require(`highlight.js/lib/languages/${file}`) as LanguageFn);
  } catch {
    return false;
  }
  return Boolean(core.getLanguage(language));
}

/** Color each line separately so escape codes never span a line break (callers split on \n). */
function colorLines(color: (text: string) => string, text: string): string {
  return text
    .split('\n')
    .map(part => (part ? color(part) : part))
    .join('\n');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" };

/** Convert highlight.js HTML to ANSI: each text run takes the color of its innermost themed scope. */
function htmlToAnsi(html: string, colors: HighlightTheme): string {
  const plain = colors.default ?? ((text: string) => text);
  const stack: Array<((text: string) => string) | undefined> = [];
  let out = '';
  // Adjacent runs that share a color are joined, so entities don't split them into extra escape codes.
  let pending = '';
  let pendingColor = plain;
  const flush = () => {
    if (pending) out += colorLines(pendingColor, pending);
    pending = '';
  };
  for (const match of html.matchAll(/<span class="([^"]*)">|<\/span>|&(amp|lt|gt|quot|#x27|#39);|[^<&]+|[<&]/g)) {
    if (match[1] !== undefined) {
      const scope = match[1].split(' ')[0]!.replace(/^hljs-/, '');
      stack.push(colors[scope] ?? stack[stack.length - 1]);
      continue;
    }
    if (match[0] === '</span>') {
      stack.pop();
      continue;
    }
    const color = stack[stack.length - 1] ?? plain;
    if (color !== pendingColor) {
      flush();
      pendingColor = color;
    }
    pending += match[2] ? ENTITIES[match[2]]! : match[0];
  }
  flush();
  return out;
}

/**
 * Highlight `code` as `language`. Unknown or missing languages come back in the theme's default
 * color (no auto-detection, which would need every language loaded).
 */
export function highlightCode(code: string, language: string | undefined, colors = CODE_HIGHLIGHT_THEME): string {
  if (!language || !ensureLanguage(language)) return colors.default ? colorLines(colors.default, code) : code;
  return htmlToAnsi(getHljs().highlight(code, { language, ignoreIllegals: true }).value, colors);
}
