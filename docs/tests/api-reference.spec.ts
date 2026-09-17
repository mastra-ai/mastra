import { expect, test, type Page } from '@playwright/test'
import {
  probeApiConfiguration,
  probeApiMethod,
  probeApiDeclarations,
  probeApiNoScriptDeclarations,
  probeApiOptions,
  probeApiSources,
  probeApiTypes,
  probeApiOutput,
  apiArticleBox,
  expectedApiGenerateIds,
} from './helpers/api-reference-probes'

const configuration = '/reference/configuration'
const generate = '/reference/agents/generate'
const appendix = '/reference/agents/generate/types'

function entryIds(page: Page) {
  return page.locator('[data-api-entry]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-api-entry')))
}

function collectFailures(page: Page) {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  page.on('console', message => {
    if (
      message.type() === 'error' ||
      (message.type() === 'warning' && /hydrat|server.rendered|did not match/i.test(message.text()))
    )
      failures.push(message.text())
  })
  return failures
}

test('retains exact declarations and canonical generics without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(`${baseURL}${generate}`)
    expect((await probeApiNoScriptDeclarations(page)).C1noScript).toBe(true)
    const definitions = page.locator('[data-api-definition]')
    await expect(definitions).toHaveCount(3)
    for (const definition of await definitions.all()) {
      await expect(definition).toBeVisible()
      await expect(definition.locator('pre').first()).toContainText('AgentExecutionOptionsBase')
    }
  } finally {
    await context.close()
  }
})

test('keeps the compact call hierarchy and opens exact declarations and generic targets', async ({ page }) => {
  await page.goto(generate)
  expect((await probeApiMethod(page)).checks.C1).toBe(true)
  expect((await probeApiDeclarations(page)).C1declarations).toBe(true)
})

test('retains discriminator owners and generic metadata with the scoped type-card recipe', async ({ page }) => {
  await page.goto(appendix)
  const { checks } = await probeApiTypes(page)
  expect(checks.C4).toBe(true)
  expect(checks.C5).toBe(true)
  expect(checks.C7).toBe(true)
})

test('fits three parameter and return columns and aligns the appendix article', async ({ page }) => {
  await page.goto(generate)
  expect((await probeApiMethod(page)).checks.C6mobile).toBe(true)
  expect((await probeApiOutput(page)).C6output).toBe(true)
  const method = await apiArticleBox(page)
  await page.goto(appendix)
  const article = await apiArticleBox(page)
  expect(Math.abs(method.left - article.left)).toBeLessThanOrEqual(8)
  expect(Math.abs(method.width - article.width)).toBeLessThanOrEqual(8)
})

for (const width of [996, 997]) {
  test(`matches the method article at the ${width}px rail boundary`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(generate)
    const method = await apiArticleBox(page)
    await page.goto(appendix)
    const article = await apiArticleBox(page)
    expect(Math.abs(method.left - article.left)).toBeLessThanOrEqual(8)
    expect(Math.abs(method.width - article.width)).toBeLessThanOrEqual(8)
  })
}

for (const theme of ['light', 'dark']) {
  test(`migrated method keeps declarations, options and appendix geometry in ${theme}`, async ({ page }) => {
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto(generate)
    expect((await probeApiDeclarations(page)).C1declarations).toBe(true)
    expect((await probeApiOptions(page)).C2destinations).toBe(true)
    expect((await probeApiOutput(page)).C6output).toBe(true)
    const method = await apiArticleBox(page)
    await page.goto(appendix)
    await expect(page.locator('main[data-api-parent-sidebar]')).toHaveCount(1)
    const article = await apiArticleBox(page)
    expect(Math.abs(method.left - article.left)).toBeLessThanOrEqual(8)
    expect(Math.abs(method.width - article.width)).toBeLessThanOrEqual(8)
    await page.getByRole('link', { name: 'Back to the method reference', exact: true }).click()
    await expect(page).toHaveURL(/\/reference\/agents\/generate\/?$/)
  })
}

for (const width of [996, 997]) {
  test(`migrated appendix matches its sidebar-bearing parent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(generate)
    await expect(page.locator('.theme-doc-sidebar-container')).toBeVisible()
    // At 996px Docusaurus omits sidebar contents; the theme already uses desktop navbar links.
    const navigation =
      width === 996
        ? page.getByRole('link', { name: 'Reference', exact: true })
        : page.locator('.theme-doc-sidebar-container').getByRole('link').first()
    await expect(navigation).toBeVisible()
    await navigation.click()
    await expect(page).not.toHaveURL(/\/reference\/agents\/generate\/?$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/reference\/agents\/generate\/?$/)
    const method = await apiArticleBox(page)
    await page.goto(appendix)
    const article = await apiArticleBox(page)
    expect(Math.abs(method.left - article.left)).toBeLessThanOrEqual(8)
    expect(Math.abs(method.width - article.width)).toBeLessThanOrEqual(8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/_vercel/insights/script.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  )
})

test('renders the complete Config surface without duplicate member anchors or hydration failures', async ({ page }) => {
  const failures = collectFailures(page)
  await page.goto(configuration)
  await expect(page.locator('[data-api-reference]')).toHaveCount(1)
  expect((await probeApiConfiguration(page)).C4staticConfig).toBe(true)
  const ids = await entryIds(page)
  expect(new Set(ids).size).toBe(ids.length)
  await page.getByRole('region', { name: 'Properties', exact: true }).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  expect(failures).toEqual([])
})

test('renders the complete method and appendix surfaces without duplicate member anchors or hydration failures', async ({
  page,
}) => {
  const failures = collectFailures(page)
  await page.goto(generate)
  await expect(page.locator('[data-api-reference]')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Method overloads', exact: true }).getByRole('tab')).toHaveCount(4)
  const ids = await entryIds(page)
  expect(new Set(ids).size).toBe(ids.length)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.getByRole('link', { name: 'Supporting types', exact: true }).click()
  await page.waitForURL(`**${appendix}`)
  const variants = page
    .getByRole('article', { name: 'AgentChunkType', exact: true })
    .getByRole('table', { name: 'Union variants', exact: true })
  await expect(variants.locator(':scope > tbody > tr')).toHaveCount(46)
  const supporting = await entryIds(page)
  expect([...ids, ...supporting].sort()).toEqual(expectedApiGenerateIds())
  expect(new Set([...ids, ...supporting]).size).toBe(ids.length + supporting.length)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  expect(failures).toEqual([])
})

test('operates built-in overload tabs with keyboard and pointer', async ({ page }) => {
  await page.goto(generate)
  const region = page.getByRole('group', { name: 'Method overloads', exact: true })
  const tabs = region.getByRole('tab')
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  for (let index = 0; index < 4; index++) {
    await tabs.nth(index).click()
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
    const panel = region.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)
    await expect(panel.getByRole('heading', { name: 'Parameters', exact: true })).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Returns:', exact: true })).toBeVisible()
    const table = panel.getByRole('table', { name: 'Parameter details', exact: true })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader')).toHaveText(['Parameter', 'Type', 'Description'])
    await expect(table.getByRole('row')).toHaveCount(index === 3 ? 2 : 3)
    if (index !== 3) {
      const options = table.getByRole('row').filter({ has: page.getByRole('link', { name: 'options', exact: true }) })
      await expect(options.getByRole('cell').first()).toHaveText('object')
      await expect(
        options
          .getByRole('cell')
          .nth(1)
          .getByRole('link', { name: /^Overload / }),
      ).toHaveCount(0)
      expect(await options.getByRole('cell').first().innerText()).not.toContain('abortSignal?:')
    }
  }
})

test('tabs options definitions and reveals the matching overload for links and history', async ({ page }) => {
  await page.goto(generate)
  const options = page.getByRole('group', { name: 'options overloads', exact: true })
  const tabs = options.getByRole('tab')
  await expect(tabs).toHaveText(['Overload 1', 'Overload 2', 'Overload 3'])
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  const hashes: string[] = []
  for (let index = 0; index < 3; index++) {
    await tabs.nth(index).click()
    const panel = options.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)
    await expect(panel.locator('[data-api-definition] > header')).toContainText(`Overload ${index + 1}`)
    const member = panel.locator('[data-api-entry]').first()
    const id = await member.getAttribute('data-api-entry')
    expect(id).toBeTruthy()
    hashes.push(`#${id}`)
  }
  for (const [index, hash] of hashes.entries()) {
    await page.goto(`${generate}${hash}`)
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(`[id="${hash.slice(1)}"]`)).toBeVisible()
    await expect(options.getByRole('tabpanel')).toHaveCount(1)
  }
  await page.reload()
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.goto(`${generate}${hashes[2]}-panel`)
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
  const method = page.getByRole('group', { name: 'Method overloads', exact: true })
  for (let index = 0; index < 3; index++) {
    await method.getByRole('tab').nth(index).click()
    await method.getByRole('tabpanel').getByRole('link', { name: 'object', exact: true }).click()
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
    await expect.poll(async () => (await tabs.first().boundingBox())?.y ?? 0).toBeGreaterThanOrEqual(48)
    await tabs.nth((index + 1) % 3).click()
    await method.getByRole('tabpanel').getByRole('link', { name: 'object', exact: true }).click()
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
  }
  expect((await probeApiOptions(page)).C2destinations).toBe(true)
})

test('keeps full accessible provenance beside each API owner', async ({ page }) => {
  await page.goto(generate)
  expect((await probeApiSources(page)).C3provenance).toBe(true)
  await page.getByRole('link', { name: 'Supporting types', exact: true }).click()
  await page.waitForURL(`**${appendix}`)
  await expect(page.getByRole('heading', { name: 'AgentChunkType', exact: true })).toBeVisible()
  expect((await probeApiSources(page)).C3provenance).toBe(true)
})

test('links each compact options type to its complete overload-specific definition', async ({ page }) => {
  await page.goto(generate)
  expect((await probeApiOptions(page)).C2destinations).toBe(true)
})

test('links to shared return fields without recursive disclosures or hidden overload dependencies', async ({
  page,
}) => {
  await page.goto(generate)
  const definitions = page.getByRole('region', { name: 'Method type definitions', exact: true })
  const output = definitions.getByRole('article', { name: 'FullOutput', exact: true })
  const field = output.getByRole('link', { name: 'rememberedMessages', exact: true })
  const target = await field.getAttribute('id')
  expect(target).toBeTruthy()
  await page.goto(`${generate}#${target}`)
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
    await page.goto(configuration)
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
    const config = page.getByRole('region', { name: 'Properties', exact: true })
    const cache = config
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'cache', exact: true }) })
      .first()
    await expect(cache.locator('code').filter({ hasText: /^InMemoryServerCache$/ })).toBeVisible()
    await expect(config.locator('details[data-api-nested]')).toHaveCount(0)
    await expect(config.locator('[data-api-nested]').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}

test('retains nested data and all overloads with JavaScript disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(`${baseURL}${generate}`)
    const region = page.getByRole('region', { name: 'Method', exact: true })
    expect((await probeApiNoScriptDeclarations(page)).C1noScript).toBe(true)
    await expect(region.getByRole('heading', { name: 'Parameters', exact: true })).toHaveCount(4)
    await expect(region.getByRole('heading', { name: 'Returns:', exact: true })).toHaveCount(4)
    const mainIds = await entryIds(page)
    await expect(page.locator('details[data-api-nested]')).toHaveCount(0)
    await expect(
      region
        .getByRole('article', { name: 'FullOutput', exact: true })
        .getByRole('link', { name: 'rememberedMessages', exact: true }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Supporting types', exact: true }).click()
    await page.waitForURL(`**${appendix}`)
    await page.waitForLoadState('load')
    const supportingIds = await entryIds(page)
    expect([...mainIds, ...supportingIds].sort()).toEqual(expectedApiGenerateIds())
    await expect(
      page
        .getByRole('article', { name: 'AgentChunkType', exact: true })
        .getByRole('table', { name: 'Union variants', exact: true })
        .locator(':scope > tbody > tr'),
    ).toHaveCount(46)
  } finally {
    await context.close()
  }
})

test('uses the static MDX transform, component registry, and top-level TOC', async ({ page }) => {
  await page.goto(configuration)
  await expect(page.locator('[data-api-reference]')).toHaveCount(1)
  const heading = page.locator('h2[id^="api-"]')
  await expect(heading).toHaveCount(1)
  await expect(heading).toContainText('Properties')
  const id = await heading.getAttribute('id')
  expect(id).toMatch(/^api-/)
  const mobileToc = page.getByRole('button', { name: 'On this page', exact: true })
  if (await mobileToc.isVisible()) await mobileToc.click()
  await expect(page.locator(`.table-of-contents a[href="#${id}"]`).first()).toBeAttached()
  await expect(
    page
      .locator('[data-api-entry]')
      .first()
      .getByRole('link', { name: /^Source: packages\/core\/src\/mastra\/index\.ts:\d+$/ }),
  ).toHaveAttribute(
    'href',
    /github\.com\/mastra-ai\/mastra\/blob\/[a-f0-9]{40}\/packages\/core\/src\/mastra\/index\.ts#L\d+/,
  )
})
