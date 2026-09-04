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

export async function highlight(code: string, language: string): Promise<ThemedToken[][] | null> {
  const lang = langAliases[language?.toLowerCase()];
  if (!lang) return null;

  const highlighter = await getHighlighter();

  const { tokens } = highlighter.codeToTokens(code, {
    lang,
    defaultColor: false,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });

  return tokens;
}
