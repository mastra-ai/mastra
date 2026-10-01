import type { HighlighterCore, ThemedToken } from 'shiki/core';

/**
 * Languages we support for syntax highlighting in code blocks. A superset of
 * the editable CodeMirror `codeLanguages` set: read-only blocks (markdown
 * fences, chat output) also carry yaml, diff, css, html, xml and sql. Using
 * fine-grained Shiki imports (rather than the full `shiki` bundle) means only
 * these grammars are bundled, instead of a chunk for every language Shiki
 * knows about.
 */
const langAliases: Record<string, string> = {
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

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
      ]);

      return createHighlighterCore({
        themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
        langs: [
          import('shiki/langs/javascript.mjs'),
          import('shiki/langs/typescript.mjs'),
          import('shiki/langs/tsx.mjs'),
          import('shiki/langs/jsx.mjs'),
          import('shiki/langs/json.mjs'),
          import('shiki/langs/bash.mjs'),
          import('shiki/langs/markdown.mjs'),
          import('shiki/langs/python.mjs'),
          import('shiki/langs/yaml.mjs'),
          import('shiki/langs/diff.mjs'),
          import('shiki/langs/css.mjs'),
          import('shiki/langs/html.mjs'),
          import('shiki/langs/xml.mjs'),
          import('shiki/langs/sql.mjs'),
        ],
        engine: createJavaScriptRegexEngine(),
      });
    })();
  }

  return highlighterPromise;
}

/** Tokenizing is synchronous and regex-heavy; past this size a single block would lock the page. */
const MAX_HIGHLIGHT_LENGTH = 200_000;
const CACHE_SIZE = 200;

const cache = new Map<string, ThemedToken[][]>();
let queue: Promise<unknown> = Promise.resolve();

const nextTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Highlights run one at a time, each in its own task: a document with dozens of fenced
 * blocks would otherwise tokenize them all back to back the moment the highlighter
 * loads, freezing the page for as long as that takes.
 */
export function highlight(code: string, language: string): Promise<ThemedToken[][] | null> {
  const lang = langAliases[language?.toLowerCase()];
  if (!lang || code.length > MAX_HIGHLIGHT_LENGTH) return Promise.resolve(null);

  const key = `${lang}\u0000${code}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  const run = queue.then(async () => {
    const highlighter = await getHighlighter();
    await nextTask();

    const hit = cache.get(key);
    if (hit) return hit;

    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      defaultColor: false,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    });

    const oldest = cache.keys().next().value;
    if (cache.size >= CACHE_SIZE && oldest !== undefined) cache.delete(oldest);
    cache.set(key, tokens);
    return tokens;
  });

  queue = run.catch(() => {});
  return run;
}

export function languageForPath(path: string | undefined): string | undefined {
  const extension = path?.split('.').pop()?.toLowerCase();
  return extension ? langAliases[extension] : undefined;
}
