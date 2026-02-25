import { test, expect } from '@playwright/test'
import { pages } from './helpers/pages'

/**
 * Console-error patterns to ignore — known benign warnings from
 * React hydration, Docusaurus internals, and third-party scripts.
 */
const IGNORED_CONSOLE_PATTERNS = [
  // React hydration warnings
  /Hydration failed because/i,
  /There was an error while hydrating/i,
  /Text content did not match/i,
  /did not match\. Server/i,
  // Docusaurus dev-mode warnings
  /Warning:.*Docusaurus/i,
  // Third-party services (may fail without API keys in local/CI)
  /posthog/i,
  /kapa/i,
  /hubspot|hs-scripts/i,
  /google.*tag|gtag|gtm/i,
  /algolia/i,
  /reo\.dev/i,
  // Browser extensions & service workers
  /chrome-extension/i,
  /service-worker/i,
  // CSP report-only violations from embedded content (e.g. YouTube iframes)
  /Content Security Policy/i,
  // Browser's generic "Failed to load resource" message — we track these properly
  // via page.on('response') with URL-based filtering above, so no need to fail
  // on the bare console message (which contains no URL context)
  /^Failed to load resource/i,
  // Common benign warnings
  /Download the React DevTools/i,
  /ResizeObserver loop/i,
]

/**
 * Third-party URL patterns whose network failures are expected
 * in local/CI (no API keys, not deployed on Vercel, etc.).
 */
const IGNORED_REQUEST_PATTERNS = [
  /_vercel\/insights/,
  /_vercel\/speed-insights/,
  /posthog/i,
  /hs-scripts\.com/i,
  /hubspot/i,
  /google.*tag|googletagmanager|gtag/i,
  /csp\.withgoogle\.com/i,
  /algolia/i,
  /kapa/i,
  /reo\.dev/i,
  /sentry/i,
]

function isIgnoredConsoleError(message: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some(pattern => pattern.test(message))
}

function isIgnoredRequest(url: string): boolean {
  return IGNORED_REQUEST_PATTERNS.some(pattern => pattern.test(url))
}

function isCriticalError(message: string): boolean {
  const criticalPatterns = [
    /TypeError:/,
    /ReferenceError:/,
    /SyntaxError:/,
    /RangeError:/,
    /URIError:/,
    /EvalError:/,
    /net::ERR_/,
    /Failed to fetch/,
    /NetworkError/,
    /ChunkLoadError/,
    /Loading chunk .* failed/,
  ]
  return criticalPatterns.some(pattern => pattern.test(message))
}

test.describe('Smoke tests', () => {
  for (const pageConfig of pages) {
    test(`${pageConfig.name} (${pageConfig.path}) loads without errors`, async ({ page }) => {
      const jsErrors: string[] = []
      const consoleErrors: string[] = []
      const failedRequests: string[] = []

      page.on('pageerror', error => {
        const msg = error.message || error.toString()
        if (!isIgnoredConsoleError(msg)) {
          jsErrors.push(msg)
        }
      })

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (!isIgnoredConsoleError(text)) {
            consoleErrors.push(text)
          }
        }
      })

      // Track failed network requests (HTTP 4xx/5xx)
      page.on('response', resp => {
        if (resp.status() >= 400 && !isIgnoredRequest(resp.url())) {
          failedRequests.push(`${resp.status()} ${resp.url()}`)
        }
      })

      // Track requests that never got a response (DNS, TLS, net::ERR_*)
      page.on('requestfailed', req => {
        const failure = req.failure()?.errorText ?? 'unknown error'
        // net::ERR_ABORTED is a browser-initiated cancel (e.g. video preload,
        // navigation away) — not a real failure.
        if (failure === 'net::ERR_ABORTED') return
        if (!isIgnoredRequest(req.url())) {
          failedRequests.push(`${failure} ${req.url()}`)
        }
      })

      const response = await page.goto(pageConfig.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })

      expect(response, `Failed to navigate to ${pageConfig.path}`).not.toBeNull()
      expect(response!.status(), `${pageConfig.path} returned HTTP ${response!.status()}`).toBeLessThan(400)

      if (pageConfig.waitForSelector) {
        await page.waitForSelector(pageConfig.waitForSelector, { timeout: 10_000 })
      }

      // Wait for page to settle
      await page.waitForTimeout(pageConfig.extraWait ?? 2000)

      // ── Network request failures ──
      expect(
        failedRequests,
        `Failed network requests on ${pageConfig.path}:\n${failedRequests.join('\n')}`,
      ).toHaveLength(0)

      // ── Broken images (belt-and-suspenders: also catches lazy-loaded images) ──
      const brokenImages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .filter(img => {
            if (!img.src || img.src.startsWith('data:')) return false
            return img.complete && img.naturalWidth === 0
          })
          .map(img => img.src)
      })

      expect(brokenImages, `Broken images found on ${pageConfig.path}`).toHaveLength(0)

      // ── Broken videos ──
      const brokenVideos = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('video'))
          .filter(video => {
            if (!video.src && !video.querySelector('source[src]')) return false
            // networkState 3 = NETWORK_NO_SOURCE (no valid source found)
            return video.networkState === 3 || video.error !== null
          })
          .map(video => video.src || video.querySelector('source')?.src || 'unknown')
      })

      expect(brokenVideos, `Broken videos found on ${pageConfig.path}`).toHaveLength(0)

      // ── Broken iframes (YouTube, etc.) ──
      // Iframe src loads are already tracked by the response/requestfailed
      // handlers above. Check that no iframe src ended up in failedRequests.
      const iframeSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe'))
          .map(iframe => iframe.src)
          .filter(src => src && src !== 'about:blank')
      })

      const failedIframes = failedRequests.filter(entry => iframeSrcs.some(src => entry.includes(src)))
      expect(failedIframes, `Broken iframes on ${pageConfig.path}`).toHaveLength(0)

      // ── JS errors ──
      if (pageConfig.criticalErrorsOnly) {
        const critical = jsErrors.filter(isCriticalError)
        expect(critical, `Critical JS errors on ${pageConfig.path}: ${critical.join('\n')}`).toHaveLength(0)
      } else {
        expect(jsErrors, `JS errors on ${pageConfig.path}: ${jsErrors.join('\n')}`).toHaveLength(0)
      }

      // ── Console errors ──
      if (pageConfig.criticalErrorsOnly) {
        const critical = consoleErrors.filter(isCriticalError)
        expect(critical, `Critical console errors on ${pageConfig.path}: ${critical.join('\n')}`).toHaveLength(0)
      } else {
        expect(consoleErrors, `Console errors on ${pageConfig.path}: ${consoleErrors.join('\n')}`).toHaveLength(0)
      }
    })
  }

  test('404 page returns 404 status', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', {
      waitUntil: 'domcontentloaded',
    })

    expect(response).not.toBeNull()
    expect(response!.status()).toBe(404)
  })
})
