import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from 'shiki/langs/bash.mjs';
import css from 'shiki/langs/css.mjs';
import diff from 'shiki/langs/diff.mjs';
import html from 'shiki/langs/html.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import jsx from 'shiki/langs/jsx.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import python from 'shiki/langs/python.mjs';
import sql from 'shiki/langs/sql.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import xml from 'shiki/langs/xml.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import githubDarkDefault from 'shiki/themes/github-dark-default.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

const LANGUAGES = new Set([
  'bash',
  'css',
  'diff',
  'html',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'python',
  'sql',
  'tsx',
  'typescript',
  'xml',
  'yaml',
]);

const highlighter = createHighlighterCoreSync({
  themes: [githubLight, githubDarkDefault],
  langs: [bash, css, diff, html, javascript, json, jsx, markdown, python, sql, tsx, typescript, xml, yaml],
  engine: createJavaScriptRegexEngine(),
});

const LANG_ALIASES: Record<string, string> = {
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  css: 'css',
  scss: 'css',
  diff: 'diff',
  patch: 'diff',
  html: 'html',
  htm: 'html',
  javascript: 'javascript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  jsx: 'jsx',
  markdown: 'markdown',
  md: 'markdown',
  python: 'python',
  py: 'python',
  sql: 'sql',
  tsx: 'tsx',
  typescript: 'typescript',
  ts: 'typescript',
  xml: 'xml',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
};

/** Map a file extension to a Shiki language. */
const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeLanguage(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const normalized = LANG_ALIASES[language.toLowerCase()];
  return normalized && LANGUAGES.has(normalized) ? normalized : undefined;
}

/** Resolve a Shiki language from a file path's extension. */
export function languageForPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? EXT_LANG[ext] : undefined;
}

function codeContent(html: string): string {
  const match = html.match(/<code>([\s\S]*)<\/code>/);
  return match?.[1] ?? html;
}

/**
 * Highlight a line/snippet for the given language, returning safe HTML. Falls
 * back to escaped plain text when no language is known or highlighting fails.
 */
export function highlightCode(text: string, language: string | undefined): string {
  const lang = normalizeLanguage(language);
  if (lang) {
    try {
      return codeContent(
        highlighter.codeToHtml(text, {
          lang,
          themes: {
            light: 'github-light',
            dark: 'github-dark-default',
          },
        }),
      );
    } catch {
      /* fall through to escaped plain text */
    }
  }
  return escapeHtml(text);
}
