import { getFiletypeFromFileName, getSharedHighlighter } from '@pierre/diffs';

import './editor-highlight.css';

/**
 * Highlight `code` into a DOM fragment of Shiki token spans using the language
 * derived from `filePath`. Shares the Pierre highlighter (and its lazy
 * language/theme loading) with the editor surfaces, so snippets match the
 * buffer exactly. Safe DOM construction only (no innerHTML). Returns null for
 * unhighlightable content (unknown extension / plain text).
 *
 * Wrap the target element in the `editor-hl` class so the dual-theme token
 * variables resolve (see editor-highlight.css).
 */
export async function highlightToFragment(code: string, filePath: string): Promise<DocumentFragment | null> {
  const lang = getFiletypeFromFileName(filePath);
  if (lang === 'text' || lang === 'ansi') return null;
  const highlighter = await getSharedHighlighter({
    themes: ['pierre-light', 'pierre-dark'],
    langs: [lang],
  });
  const { tokens } = highlighter.codeToTokens(code, {
    lang,
    themes: { light: 'pierre-light', dark: 'pierre-dark' },
    defaultColor: false,
  });
  const fragment = document.createDocumentFragment();
  tokens.forEach((line, index) => {
    if (index > 0) fragment.appendChild(document.createTextNode('\n'));
    for (const token of line) {
      const style = token.htmlStyle;
      if (!style) {
        fragment.appendChild(document.createTextNode(token.content));
        continue;
      }
      const span = document.createElement('span');
      for (const [key, value] of Object.entries(style)) {
        span.style.setProperty(key, value);
      }
      span.textContent = token.content;
      fragment.appendChild(span);
    }
  });
  return fragment;
}
