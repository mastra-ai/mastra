import { expect, test } from '@playwright/test'

const preview = '/reference/api-visual-review'
const staticPreview = '/reference/api-static-review'

test.beforeEach(async ({ page }) => {
  await page.route('**/_vercel/insights/script.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  )
})

test('renders all complete surfaces without duplicate member anchors or hydration failures', async ({ page }) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') failures.push(message.text())
  })
  await page.goto(preview)
  await expect(page.locator('[data-api-reference]')).toHaveCount(4)
  await expect(page.getByRole('region', { name: 'Signatures', exact: true }).getByRole('tab')).toHaveCount(4)
  const ids = await page
    .locator('[data-api-entry]')
    .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-api-entry')))
  expect(ids.length).toBeGreaterThan(3000)
  expect(new Set(ids).size).toBe(ids.length)
  expect(failures).toEqual([])
})

test('operates built-in overload tabs with keyboard and pointer', async ({ page }) => {
  await page.goto(preview)
  const region = page.getByRole('region', { name: 'Signatures', exact: true })
  const tabs = region.getByRole('tab')
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  for (let index = 0; index < 4; index++) {
    await tabs.nth(index).click()
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
    await expect(region.locator('article:visible')).toHaveCount(1)
  }
})

test('opens all disclosure ancestors for direct links into nested return data', async ({ page }) => {
  await page.goto(preview)
  const returns = page.getByRole('region', { name: 'Returns', exact: true })
  const target = await returns.locator('[data-api-entry]').evaluateAll(nodes => {
    const nested = nodes.find(node => {
      let parent = node.parentElement
      let depth = 0
      while (parent) {
        if (parent.tagName === 'DETAILS') depth++
        parent = parent.parentElement
      }
      return depth >= 3
    })
    return nested?.getAttribute('data-api-entry')
  })
  expect(target).toBeTruthy()
  await page.goto(`${preview}#${target}`)
  await expect(page.locator(`[id="${target}"]`)).toBeVisible()
  expect(
    await page.locator(`[id="${target}"]`).evaluate(node => {
      let parent = node.parentElement
      while (parent) {
        if (parent instanceof HTMLDetailsElement && !parent.open) return false
        parent = parent.parentElement
      }
      return true
    }),
  ).toBe(true)
})

for (const theme of ['light', 'dark']) {
  test(`fits ${theme} mode with expanded nested data and inline defaults`, async ({ page }) => {
    await page.goto(preview)
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    const config = page.getByRole('region', { name: 'Properties', exact: true })
    const cache = config
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'cache', exact: true }) })
      .first()
    await expect(cache.locator('code').filter({ hasText: /^InMemoryServerCache$/ })).toBeVisible()
    await config.locator('details[data-api-nested]').first().locator('summary').first().click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}

test('retains nested data and all overloads with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(`http://localhost:4444${preview}`)
    const region = page.getByRole('region', { name: 'Signatures', exact: true })
    await expect(region.locator('article:visible')).toHaveCount(4)
    expect(await page.locator('[data-api-entry]').count()).toBeGreaterThan(3000)
    const details = page
      .getByRole('region', { name: 'Properties', exact: true })
      .locator('details[data-api-nested]')
      .first()
    await details.locator('summary').first().click()
    await expect(details).toHaveAttribute('open', '')
  } finally {
    await context.close()
  }
})

test('uses the static MDX transform, component registry, and top-level TOC', async ({ page }) => {
  await page.goto(staticPreview)
  await expect(page.locator('[data-api-reference]')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Signatures', exact: true }).getByRole('tab')).toHaveCount(4)
  const heading = page.locator('h2[id^="api-"]')
  await expect(heading).toHaveCount(1)
  await expect(heading).toContainText('Signatures')
  const id = await heading.getAttribute('id')
  expect(id).toMatch(/^api-/)
  const mobileToc = page.getByRole('button', { name: 'On this page', exact: true })
  if (await mobileToc.isVisible()) await mobileToc.click()
  await expect(page.locator(`.table-of-contents a[href="#${id}"]`).first()).toBeAttached()
  await expect(
    page.locator('[data-api-entry]').first().getByRole('link', { name: 'Source', exact: true }),
  ).toHaveAttribute(
    'href',
    /github\.com\/mastra-ai\/mastra\/blob\/[a-f0-9]{40}\/packages\/core\/src\/agent\/agent\.ts#L\d+/,
  )
})
