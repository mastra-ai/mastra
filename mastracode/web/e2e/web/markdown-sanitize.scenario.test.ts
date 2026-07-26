import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderMarkdown } from '../../src/web/ui/ui/Markdown.js';

// Agent output is rendered as markdown via dangerouslySetInnerHTML, and it can
// contain attacker-influenced text (file contents, tool output, fetched pages).
// These tests pin the sanitization that prevents XSS from that content.
describe('markdown sanitization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops javascript: link hrefs but keeps the visible text', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/<a[^>]*href=["']javascript:/i);
    expect(html).toContain('click me');
  });

  it('drops data: and vbscript: link hrefs', () => {
    expect(renderMarkdown('[x](data:text/html,<script>alert(1)</script>)')).not.toMatch(/href=["']data:/i);
    expect(renderMarkdown('[x](vbscript:msgbox(1))')).not.toMatch(/href=["']vbscript:/i);
  });

  it('strips control characters that try to hide a scheme', () => {
    const html = renderMarkdown('[x](java\tscript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('allows safe http/https/mailto links', () => {
    expect(renderMarkdown('[ok](https://example.com)')).toMatch(/href=["']https:\/\/example\.com["']/);
    expect(renderMarkdown('[mail](mailto:a@b.com)')).toMatch(/href=["']mailto:a@b\.com["']/);
  });

  it('adds rel="noopener" to rendered links', () => {
    expect(renderMarkdown('[ok](https://example.com)')).toMatch(/rel=["'][^"']*noopener/);
  });

  it('drops javascript: image src but keeps alt text', () => {
    const html = renderMarkdown('![alt text](javascript:alert(1))');
    expect(html).not.toMatch(/src=["']javascript:/i);
    expect(html).toContain('alt text');
  });

  it('escapes raw HTML in the markdown source', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain('&lt;img');
  });

  it('escapes HTML inside inline code spans', () => {
    const html = renderMarkdown('`<img src=x onerror=alert(1)>`');
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain('&lt;img');
  });

  it('escapes the raw source when markdown parsing throws', async () => {
    // A payload crafted to trigger a parser error must not bypass sanitization:
    // the catch fallback escapes the raw source instead of returning it as-is.
    vi.resetModules();
    vi.doMock('marked', () => ({
      Marked: class {
        use() {}
        parse() {
          throw new Error('parse error');
        }
      },
    }));
    const { renderMarkdown: render } = await import('../../src/web/ui/ui/Markdown.js');
    const html = render('<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain('&lt;img');
    vi.doUnmock('marked');
    vi.resetModules();
  });
});
