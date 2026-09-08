/**
 * Markdown alternate link injection
 *
 * Each built page has a clean markdown twin. The HTML itself does not say so, which means agents and
 * reader proxies convert the HTML again instead of reading the markdown we already generated. A
 * `<link rel="alternate" type="text/markdown">` tag in the head advertises the markdown URL to any
 * client that parses the page.
 */

/** Media type used for the markdown alternate. */
const MARKDOWN_MEDIA_TYPE = 'text/markdown'

/**
 * Build the absolute markdown URL for a route.
 *
 * Every route is served as markdown at `<route>.md`. The root route has no `.md` form, so it points
 * at the site-wide index instead.
 */
export function markdownUrlForRoute(route: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')

  if (route === '/') {
    return `${base}/llms.txt`
  }

  return `${base}${route.replace(/\/$/, '')}.md`
}

/**
 * Insert the markdown alternate link into an HTML document.
 *
 * Returns the HTML unchanged when the tag is already present or when there is no head to insert
 * into, so running the plugin twice over the same output stays safe.
 */
export function injectMarkdownAlternateLink(html: string, markdownUrl: string): string {
  if (html.includes(`type="${MARKDOWN_MEDIA_TYPE}"`)) {
    return html
  }

  const closingHead = html.indexOf('</head>')

  if (closingHead === -1) {
    return html
  }

  const tag = `<link rel="alternate" type="${MARKDOWN_MEDIA_TYPE}" href="${escapeAttribute(markdownUrl)}">`

  return html.slice(0, closingHead) + tag + html.slice(closingHead)
}

/** Escape the characters that would end the href attribute early. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
