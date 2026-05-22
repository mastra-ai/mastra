import DOMPurify from 'dompurify'

/**
 * Sanitize Algolia highlighted result HTML before it is rendered via
 * `dangerouslySetInnerHTML`. Algolia wraps matched terms in `<mark>` tags; every
 * other tag and attribute is stripped while the text content is kept.
 *
 * This assumes the default `highlightPreTag` / `highlightPostTag` of `<mark>`.
 * If a custom highlight tag is ever configured, add it to `ALLOWED_TAGS`.
 *
 * Only ever called from the browser (inside a `useEffect`), so DOMPurify has a
 * real DOM. The Node unit test runs with the jsdom environment.
 */
export function sanitizeSearchHtml(html: string): string {
  if (!html) return ''

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  })
}
