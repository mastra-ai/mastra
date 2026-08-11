import { Marked } from 'marked';
import { escapeHtml, highlightCode, normalizeLanguage } from './highlight';

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
      const language = normalizeLanguage(lang);
      const highlighted = highlightCode(text, language);
      const codeClass = `block bg-transparent p-0 font-inherit text-inherit leading-inherit dark:[&_span]:![color:var(--shiki-dark)] dark:[&_span]:![background-color:var(--shiki-dark-bg)]${language ? ` language-${language}` : ''}`;
      return `<pre class="my-[0.6em] overflow-x-auto rounded-md border border-border1 bg-surface2 px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] shadow-sm"><code class="${codeClass}">${highlighted}</code></pre>`;
    },
    codespan({ text }) {
      // marked does not escape custom-renderer text, so escape it ourselves to
      // prevent inline code like `<img onerror=...>` from injecting markup.
      return `<code class="rounded-[3px] bg-surface2 px-1.5 py-px font-mono text-[0.9em]">${escapeHtml(text)}</code>`;
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
    // If parsing fails, never return the raw source: it is injected via
    // dangerouslySetInnerHTML, so escape it to prevent XSS from a payload
    // crafted to trigger a parser error.
    return escapeHtml(src);
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
  const html = renderMarkdown(children);

  return (
    <div
      className={`[&_a]:text-accent1 [&_blockquote]:border-border1 [&_blockquote]:text-icon3 [&_hr]:border-border1 font-sans text-[13.5px] leading-[1.7] break-words [&_a:hover]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-3 [&_blockquote]:py-1 [&_blockquote]:pl-3 [&_em]:italic [&_h1]:my-3 [&_h1]:text-[1.3em] [&_h1]:leading-tight [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-[1.15em] [&_h2]:leading-tight [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-[1.05em] [&_h3]:leading-tight [&_h3]:font-bold [&_h4]:my-3 [&_h4]:text-[1em] [&_h4]:leading-tight [&_h4]:font-bold [&_hr]:my-3 [&_hr]:border-0 [&_hr]:border-t [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:pl-6 [&_p]:my-[0.4em] [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:my-2 [&_ul]:pl-6 ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
