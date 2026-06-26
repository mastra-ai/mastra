import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';
import { useMemo } from 'react';

// Register commonly-used languages (tree-shakeable vs importing the full bundle).
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', shell);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

/** Escape HTML special characters so text can't inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Return a safe href, or null if the URL uses a dangerous scheme. Agent output
 * can contain attacker-influenced links, so block `javascript:`, `data:`,
 * `vbscript:`, and similar script-bearing schemes. Relative URLs and the common
 * safe schemes (http/https/mailto/tel) are allowed.
 */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  // Strip control/whitespace chars that can hide a scheme (e.g. "java\tscript:").

  const collapsed = url.replace(/[\u0000-\u001f\u007f-\u009f\s]/g, '').toLowerCase();
  const scheme = collapsed.match(/^([a-z][a-z0-9+.-]*):/);
  if (scheme) {
    const allowed = new Set(['http', 'https', 'mailto', 'tel']);
    if (!allowed.has(scheme[1])) return null;
  }
  return url;
}

const marked = new Marked({
  breaks: true,
  gfm: true,
});

// Custom renderer for code blocks with syntax highlighting.
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : undefined;
      // hljs.highlight/highlightAuto return HTML-escaped, token-wrapped output.
      const highlighted = language ? hljs.highlight(text, { language }).value : hljs.highlightAuto(text).value;
      return `<pre class="code-block"><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`;
    },
    codespan({ text }) {
      // marked does not escape custom-renderer text, so escape it ourselves to
      // prevent inline code like `<img onerror=...>` from injecting markup.
      return `<code class="inline-code">${escapeHtml(text)}</code>`;
    },
    // Neutralize raw inline/block HTML in the markdown source: render it as
    // visible escaped text instead of live markup. Agent output should not be
    // able to inject arbitrary HTML/script into the page.
    html({ text }) {
      return escapeHtml(text);
    },
    // Sanitize link/image URLs so a markdown link/image cannot smuggle a
    // `javascript:`/`data:` scheme into a clickable anchor or src.
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const safe = safeUrl(href);
      if (!safe) return inner; // Drop the unsafe link, keep its visible text.
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safe)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;
    },
    image({ href, title, text }) {
      const safe = safeUrl(href);
      const alt = escapeHtml(text ?? '');
      if (!safe) return alt; // Drop the unsafe image, keep its alt text.
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(safe)}" alt="${alt}"${titleAttr} />`;
    },
  },
});

/**
 * Parse a markdown string to sanitized HTML. Raw HTML is neutralized, inline
 * code is escaped, and link/image URLs with dangerous schemes are dropped.
 * Exported for testing the sanitization in isolation.
 */
export function renderMarkdown(src: string): string {
  try {
    return marked.parse(src) as string;
  } catch {
    return src;
  }
}

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders a markdown string as formatted HTML with syntax-highlighted code
 * blocks. Agent output can contain attacker-influenced text (file contents,
 * tool output, web pages), so raw HTML is neutralized and code spans are
 * escaped before being injected via `dangerouslySetInnerHTML`.
 */
export function Markdown({ children, className }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(children), [children]);

  return <div className={`markdown ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
