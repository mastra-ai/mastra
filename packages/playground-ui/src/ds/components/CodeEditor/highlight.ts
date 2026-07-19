import type { HighlighterCore, ThemedToken } from 'shiki/core';

/**
 * Languages we support for syntax highlighting in code blocks. Kept in sync
 * with the CodeMirror `codeLanguages` set. Using fine-grained Shiki imports
 * (rather than the full `shiki` bundle) means only these grammars are bundled,
 * instead of a chunk for every language Shiki knows about.
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
