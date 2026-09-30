import { highlightCode, tagHighlighter, tags as t } from '@lezer/highlight';

import { loadLanguageSupport } from './languages';

// The `.tok-*` palette and `data-editor-theme` preset overrides ship with the
// highlighter so every consumer (editor chunk and chat transcript) gets them.
import './editor-syntax.css';

/**
 * One highlighter for every code surface in the editor domain — the buffer,
 * search previews, and LSP hover signatures. Emits stable `.tok-*` classes
 * styled in `editor-syntax.css` from design-system variables, so a single
 * palette (VS Code Dark+-flavored) applies everywhere and flips with
 * `html.light` automatically.
 */
export const editorHighlighter = tagHighlighter([
  // Control flow + module keywords read purple in VS Code (`if`, `return`,
  // `import`); declaration keywords read blue (`const`, `function`, `class`).
  { tag: [t.controlKeyword, t.moduleKeyword], class: 'tok-controlKeyword' },
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.definitionKeyword, t.self], class: 'tok-keyword' },
  { tag: [t.string, t.special(t.string), t.character, t.docString], class: 'tok-string' },
  { tag: t.regexp, class: 'tok-regexp' },
  { tag: [t.number], class: 'tok-number' },
  { tag: [t.bool, t.null, t.atom, t.constant(t.name)], class: 'tok-atom' },
  { tag: [t.comment, t.blockComment, t.lineComment], class: 'tok-comment' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], class: 'tok-function' },
  { tag: [t.typeName, t.className, t.namespace], class: 'tok-type' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.propertyName)], class: 'tok-property' },
  { tag: [t.variableName, t.definition(t.variableName), t.special(t.variableName)], class: 'tok-variable' },
  { tag: t.labelName, class: 'tok-variable' },
  { tag: t.tagName, class: 'tok-tag' },
  { tag: t.operator, class: 'tok-operator' },
  { tag: [t.punctuation, t.separator, t.bracket], class: 'tok-punctuation' },
  { tag: t.meta, class: 'tok-meta' },
  { tag: t.heading, class: 'tok-heading' },
  { tag: t.emphasis, class: 'tok-emphasis' },
  { tag: t.strong, class: 'tok-strong' },
  { tag: t.link, class: 'tok-link' },
  { tag: t.url, class: 'tok-link' },
  { tag: t.strikethrough, class: 'tok-strikethrough' },
  { tag: t.inserted, class: 'tok-inserted' },
  { tag: t.deleted, class: 'tok-deleted' },
  { tag: t.invalid, class: 'tok-invalid' },
]);

/**
 * Highlight `code` into a DOM fragment of `.tok-*` spans using the language
 * derived from `filePath`. Safe DOM construction only (no innerHTML). Returns
 * null when no language is registered for the extension.
 */
export async function highlightToFragment(code: string, filePath: string): Promise<DocumentFragment | null> {
  const support = await loadLanguageSupport(filePath);
  if (!support) return null;
  const tree = support.language.parser.parse(code);
  const fragment = document.createDocumentFragment();
  highlightCode(
    code,
    tree,
    editorHighlighter,
    (text, classes) => {
      if (classes) {
        const span = document.createElement('span');
        span.className = classes;
        span.textContent = text;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(text));
      }
    },
    () => {
      fragment.appendChild(document.createTextNode('\n'));
    },
  );
  return fragment;
}

/** Highlight `code` in place inside `el`, leaving plain text when no language matches. */
export async function highlightInto(el: HTMLElement, code: string, filePath: string): Promise<void> {
  const fragment = await highlightToFragment(code, filePath);
  if (fragment) el.replaceChildren(fragment);
}

/** Map fenced-code language names (from LSP hovers) to a file extension. */
const FENCE_LANGUAGES: Record<string, string> = {
  typescript: 'ts',
  typescriptreact: 'tsx',
  javascript: 'js',
  javascriptreact: 'jsx',
  python: 'py',
  rust: 'rs',
  golang: 'go',
  markdown: 'md',
};

/** A pseudo file path for a fence language, falling back to the current file. */
export function fenceLanguagePath(fenceInfo: string, fallbackPath: string): string {
  const info = fenceInfo.trim().toLowerCase();
  if (!info) return fallbackPath;
  return `x.${FENCE_LANGUAGES[info] ?? info}`;
}
