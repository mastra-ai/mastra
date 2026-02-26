import { test, expect } from '@playwright/test'

const OG_TEST_PAGES = [
  { path: '/docs', name: 'Docs – Introduction' },
  { path: '/docs/getting-started/start', name: 'Docs – Getting Started' },
  { path: '/models', name: 'Models – Index' },
  { path: '/models/providers/openai', name: 'Models – OpenAI' },
  { path: '/guides/getting-started/quickstart', name: 'Guides – Quickstart' },
  { path: '/reference/configuration', name: 'Reference – Configuration' },
]

/**
 * Extract og:image content from HTML.
 * Handles double-quoted, single-quoted, and unquoted attribute values
 * (Docusaurus may omit quotes on attributes).
 */
function extractOgImage(html: string): string | null {
  // Pattern 1: property before content
  const m1 = html.match(/<meta\s[^>]*property=["']?og:image["']?\s[^>]*content=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  if (m1) return m1[1] ?? m1[2] ?? m1[3] ?? null

  // Pattern 2: content before property
  const m2 = html.match(/<meta\s[^>]*content=(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s[^>]*property=["']?og:image["']?/i)
  if (m2) return m2[1] ?? m2[2] ?? m2[3] ?? null

  return null
}

for (const page of OG_TEST_PAGES) {
  test(`${page.name} has a valid og:image`, async ({ request, baseURL }) => {
    // Fetch the HTML page
    const response = await request.get(page.path)
    expect(response.status()).toBeLessThan(400)

    const html = await response.text()

    const ogImageUrl = extractOgImage(html)
    expect(ogImageUrl, `og:image meta tag not found on ${page.path}`).toBeTruthy()

    // Verify the URL is non-empty and looks like a valid URL
    expect(ogImageUrl!.length, `og:image URL is empty on ${page.path}`).toBeGreaterThan(0)
    expect(
      ogImageUrl!.startsWith('http://') || ogImageUrl!.startsWith('https://') || ogImageUrl!.startsWith('/'),
      `og:image URL is not a valid URL: ${ogImageUrl}`,
    ).toBe(true)

    // If the OG image is a local/relative URL, fetch and verify it
    if (ogImageUrl!.startsWith('/')) {
      const imageUrl = `${baseURL}${ogImageUrl}`
      const imageResponse = await request.get(imageUrl)
      expect(imageResponse.status(), `OG image returned non-200 for ${page.path}: ${imageUrl}`).toBe(200)

      const contentType = imageResponse.headers()['content-type'] ?? ''
      expect(contentType, `OG image content-type is not an image for ${page.path}`).toContain('image/')

      const body = await imageResponse.body()
      expect(body.length, `OG image body is too small (< 1KB) for ${page.path}`).toBeGreaterThan(1024)
    }

    // For production URLs (e.g., https://mastra.ai/api/og/...), just verify the URL format
    // since we can't resolve the production API endpoint in local tests
  })
}
