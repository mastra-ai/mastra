import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page } from '@playwright/test'
import { parseContract } from '../../src/api-reference/schema'
import { memberAnchor } from '../../src/api-reference/presentation'
import { traverseSurface } from '../../src/api-reference/traversal'

export function expectedApiPreviewIds() {
  const agent = parseContract(JSON.parse(readFileSync(resolve('src/data/api-reference/agent-generate.json'), 'utf8')))
  const config = parseContract(JSON.parse(readFileSync(resolve('src/data/api-reference/configuration.json'), 'utf8')))
  return [
    ...new Set(
      [
        ...traverseSurface(agent, 'method').nodes.keys(),
        ...traverseSurface(config, 'properties').nodes.keys(),
        ...agent.declarations[agent.root].signatures.flatMap(id => [`${id}:parameters`, `${id}:returns`]),
      ].map(memberAnchor),
    ),
  ].sort()
}

export async function probeApiConfiguration(page: Page) {
  const config = parseContract(JSON.parse(readFileSync(resolve('src/data/api-reference/configuration.json'), 'utf8')))
  const expected = [...traverseSurface(config, 'properties').nodes.keys()].map(memberAnchor).sort()
  const properties = page.getByRole('region', { name: 'Properties', exact: true })
  await expect(properties).toBeVisible()
  const actual = await page
    .locator('[data-api-entry]')
    .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-api-entry')).sort())
  return {
    C4staticConfig:
      JSON.stringify(actual) === JSON.stringify(expected) &&
      (await properties.locator('[data-api-nested]').count()) > 0 &&
      (await properties.locator('details[data-api-nested]').count()) === 0,
  }
}

export async function probeApiSources(page: Page) {
  return page.locator('[data-api-source]').evaluateAll(controls => {
    const owners = new Set<string>()
    return {
      C3provenance:
        controls.length > 0 &&
        controls.every(control => {
          const source = control.getAttribute('data-api-source') ?? ''
          const owner = control.closest('[data-api-entry]')?.getAttribute('data-api-entry')
          if (!owner || owners.has(owner)) return false
          owners.add(owner)
          const link = control.querySelector('a')
          const accessible = link?.getAttribute('aria-label') ?? control.textContent ?? ''
          const placed = control.closest('header,th') || control.previousElementSibling?.matches('code[data-api-type]')
          return (
            source.startsWith('packages/') &&
            accessible.includes(source) &&
            Boolean(placed) &&
            (!link || /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[a-f0-9]{40}\//.test(link.href))
          )
        }),
    }
  })
}

export async function probeApiOptions(page: Page) {
  const contract = parseContract(
    JSON.parse(readFileSync(resolve('src/data/api-reference/agent-generate.json'), 'utf8')),
  )
  const original = page.url().split('#')[0]
  const region = page.getByRole('region', { name: 'Method', exact: true })
  if (!(await region.locator('[data-api-definition]').count())) return { C2destinations: false }
  for (const [index, id] of contract.declarations[contract.root].signatures.entries()) {
    const signature = contract.declarations[id]
    const parameter = signature.parameters[1] ? contract.declarations[signature.parameters[1]] : undefined
    const method = region.locator(':scope > div').first()
    await method.getByRole('tab').nth(index).click()
    const table = method.getByRole('tabpanel').getByRole('table', { name: 'Parameter details', exact: true })
    await expect(table.locator('tbody > tr')).toHaveCount(signature.parameters.length)
    if (!parameter) continue
    const row = table.locator(`[data-api-entry="${memberAnchor(parameter.id)}"]`)
    const cell = row.getByRole('cell').first()
    await expect(cell).toHaveText('object')
    await expect(
      row
        .getByRole('cell')
        .nth(1)
        .getByRole('link', { name: /^Overload / }),
    ).toHaveCount(0)
    const link = cell.getByRole('link', { name: 'object', exact: true })
    expect(await link.getAttribute('href')).not.toBe(`#${memberAnchor(parameter.id)}`)
    await link.click()
    const definition = region.locator(`[data-api-definition="${memberAnchor(parameter.id)}"]`)
    await expect(definition.getByRole('heading', { name: parameter.name, exact: true }).first()).toBeVisible()
    await expect(definition.locator('header').first()).toContainText(`Overload ${index + 1}`)
    expect((await definition.locator('pre code').first().locator('.token-line').allTextContents()).join('\n')).toBe(
      parameter.sourceType,
    )
    for (const operand of parameter.type?.operands ?? []) {
      if (!operand.type.declaration) continue
      const shape = contract.declarations[operand.type.declaration]
      await expect(definition.locator(`[data-api-entry="${memberAnchor(shape.id)}"]`)).toHaveCount(1)
      for (const field of shape.children)
        await expect(definition.locator(`[data-api-entry="${memberAnchor(field)}"]`)).toHaveCount(1)
    }
  }
  await page.goto(original, { waitUntil: 'domcontentloaded' })
  return { C2destinations: true }
}

export async function probeApiDeclarations(page: Page) {
  const original = page.url().split('#')[0]
  const contract = parseContract(
    JSON.parse(readFileSync(resolve('src/data/api-reference/agent-generate.json'), 'utf8')),
  )
  const signatures = contract.declarations[contract.root].signatures.map(id => contract.declarations[id])
  if (
    (await page.getByRole('region', { name: 'Method', exact: true }).locator('[data-api-call]').count()) !==
    signatures.length
  )
    return { C1declarations: false }
  try {
    for (const [index, signature] of signatures.entries()) {
      await page
        .getByRole('region', { name: 'Method', exact: true })
        .locator(':scope > div')
        .first()
        .getByRole('tab')
        .nth(index)
        .click()
      expect((await probeApiMethod(page)).checks.C1).toBe(true)
      const panel = page
        .getByRole('region', { name: 'Method', exact: true })
        .locator(':scope > div')
        .first()
        .getByRole('tabpanel')
      const details = panel
        .locator('details')
        .filter({ has: page.locator('summary', { hasText: /^TypeScript declaration$/ }) })
      await expect(details).not.toHaveAttribute('open')
      const summary = details.locator('summary')
      await summary.focus()
      await page.keyboard.press('Enter')
      await expect(details).toHaveAttribute('open')
      expect((await details.locator('pre code .token-line').allTextContents()).join('\n')).toBe(
        signature.sourceSignature,
      )
      for (const id of signature.typeParameters)
        await expect(details.locator(`[id="${memberAnchor(id)}"]`)).toBeVisible()
      await summary.focus()
      await page.keyboard.press('Enter')
      await expect(details).not.toHaveAttribute('open')
      for (const id of signature.typeParameters) {
        const anchor = memberAnchor(id)
        await panel.locator(`a[href="#${anchor}"]`).first().click()
        await expect(details).toHaveAttribute('open')
        await page.goto(`${original}#${anchor}`, { waitUntil: 'domcontentloaded' })
        await expect(
          page
            .getByRole('region', { name: 'Method', exact: true })
            .locator(':scope > div')
            .first()
            .getByRole('tab')
            .nth(index),
        ).toHaveAttribute('aria-selected', 'true')
        await expect(page.locator(`[id="${anchor}"]`)).toBeVisible()
      }
      await page.goto(original, { waitUntil: 'domcontentloaded' })
    }
    return { C1declarations: true }
  } finally {
    await page.goto(original, { waitUntil: 'domcontentloaded' })
  }
}

export async function probeApiNoScriptDeclarations(page: Page) {
  const contract = parseContract(
    JSON.parse(readFileSync(resolve('src/data/api-reference/agent-generate.json'), 'utf8')),
  )
  const signatures = contract.declarations[contract.root].signatures.map(id => contract.declarations[id])
  if (
    (await page.getByRole('region', { name: 'Method', exact: true }).locator('[data-api-call]').count()) !==
    signatures.length
  )
    return { C1noScript: false }
  for (const signature of signatures) {
    const card = page.locator(`[data-api-entry="${memberAnchor(signature.id)}"]`)
    const details = card
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: /^TypeScript declaration$/ }) })
    await expect(details).not.toHaveAttribute('open')
    await details.locator('summary').click()
    await expect(details).toHaveAttribute('open')
    expect((await details.locator('pre code .token-line').allTextContents()).join('\n')).toBe(signature.sourceSignature)
    for (const id of signature.typeParameters) await expect(details.locator(`[id="${memberAnchor(id)}"]`)).toBeVisible()
    await expect(card.locator('table').first().locator('tbody > tr')).toHaveCount(signature.parameters.length)
  }
  return { C1noScript: true }
}

export async function probeApiMethod(page: Page) {
  return page.getByRole('region', { name: 'Method', exact: true }).evaluate(surface => {
    const card = [...surface.querySelectorAll<HTMLElement>('article[data-api-entry]')].find(
      element => element.getClientRects().length > 0,
    )
    if (!card) throw new Error('No visible method card')
    const table = card.querySelector('table')
    const firstRow = table?.querySelector('tbody tr')
    const declaration = [...card.querySelectorAll('details')].find(
      element => element.querySelector('summary')?.textContent === 'TypeScript declaration',
    )
    const call = card.querySelector('[data-api-call]')
    const returns = card.querySelector('[data-api-returns]')
    const returnLinks = [...(returns?.querySelectorAll('code[data-api-type] a[href]') ?? [])]
    const redundantReturnLinks = [
      ...(returns?.closest('article')?.querySelectorAll(':scope > [data-api-nested] > p > a[href]') ?? []),
    ].some(link => returnLinks.some(inline => inline.getAttribute('href') === link.getAttribute('href')))
    const rowBottom = firstRow ? firstRow.getBoundingClientRect().bottom - card.getBoundingClientRect().top : undefined
    const bounds = table?.getBoundingClientRect()
    const article = surface.closest('article')?.getBoundingClientRect()
    const cells = [...(table?.querySelectorAll('tbody tr:first-child > th, tbody tr:first-child > td') ?? [])].map(
      cell => {
        const box = cell.getBoundingClientRect()
        return { left: box.left, right: box.right, text: cell.textContent }
      },
    )
    const option = [...(table?.querySelectorAll('tbody tr') ?? [])].find(row => row.textContent?.startsWith('options'))
    const optionType = option?.querySelector('td')
    const source = card.querySelector('[data-api-source]')
    const messageType = firstRow?.querySelector('td code')
    const range = document.createRange()
    if (messageType) range.selectNodeContents(messageType.querySelector('a')?.firstChild ?? messageType)
    const messageTypeLines = new Set([...range.getClientRects()].map(rect => rect.top)).size
    return {
      rowBottom,
      messageTypeLines,
      cells,
      checks: {
        C1: Boolean(
          call &&
          table &&
          returns &&
          returnLinks.length > 0 &&
          !redundantReturnLinks &&
          declaration &&
          !declaration.open &&
          call.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING &&
          table.compareDocumentPosition(returns) & Node.DOCUMENT_POSITION_FOLLOWING &&
          returns.compareDocumentPosition(declaration) & Node.DOCUMENT_POSITION_FOLLOWING &&
          rowBottom !== undefined &&
          rowBottom <= 480,
        ),
        C2: Boolean(optionType && optionType.textContent?.trim() === 'object' && optionType.querySelector('a[href]')),
        C3: Boolean(source && source.closest('header')),
        C6mobile: Boolean(
          bounds &&
          article &&
          bounds.left >= article.left - 1 &&
          bounds.right <= article.right + 1 &&
          table &&
          table.scrollWidth <= table.clientWidth + 1 &&
          cells.length === 3 &&
          cells.every(cell => cell.left >= article.left - 1 && cell.right <= article.right + 1) &&
          (window.innerWidth !== 390 || messageTypeLines === 1),
        ),
      },
    }
  })
}

export async function probeApiTypes(page: Page) {
  const contract = parseContract(
    JSON.parse(readFileSync(resolve('src/data/api-reference/agent-generate.json'), 'utf8')),
  )
  const chunk = Object.values(contract.declarations).find(node => node.name === 'AgentChunkType')!
  const expected = {
    variants: chunk.type!.operands.map(({ type }) => {
      const body = (type.kind === 'intersection' ? type.operands.map(operand => operand.type) : [type]).find(
        member => member.declaration,
      )!
      const owner = contract.declarations[body.declaration!]
      const discriminator = owner.children.map(id => contract.declarations[id]).find(child => child.name === 'type')!
      return {
        owner: memberAnchor(owner.id),
        discriminator: memberAnchor(discriminator.id),
        value: discriminator.type!.display,
      }
    }),
    generics: chunk.typeParameters.map(id => ({
      id: memberAnchor(id),
      name: contract.declarations[id].name,
      constraint: contract.declarations[id].type?.display,
      defaultType: contract.declarations[id].defaultType?.display,
    })),
  }
  return page.getByRole('heading', { name: 'AgentChunkType', exact: true }).evaluate((heading, expected) => {
    const card = heading.closest('article')
    if (!card) throw new Error('Missing AgentChunkType card')
    const variants = [...card.querySelectorAll('tr[data-api-entry]')]
    const repeated = variants.some(row => /type\s*:/.test(row.querySelector('td')?.textContent ?? ''))
    const genericRow = [...card.querySelectorAll('tr')].some(
      row => row.querySelector('th code')?.textContent?.trim() === 'OUTPUT',
    )
    const style = getComputedStyle(card)
    const headingStyle = getComputedStyle(heading)
    const table = card.querySelector('table')!
    const tableStyle = getComputedStyle(table)
    const cellStyle = getComputedStyle(table.querySelector('td')!)
    const columnStyle = getComputedStyle(table.querySelector('thead th')!)
    const typeStyle = getComputedStyle(table.querySelector('td code')!)
    return {
      variants: variants.length,
      checks: {
        C4: parseFloat(style.borderTopWidth) === 1 && parseFloat(style.borderRadius) === 12,
        C5:
          variants.length === 46 &&
          !repeated &&
          !genericRow &&
          expected.variants.every(variant => {
            const row = card.querySelector(`[data-api-entry="${variant.owner}"]`)
            const field = row?.querySelector(`th [data-api-entry="${variant.discriminator}"]`)
            return Boolean(
              field &&
              field.querySelector('code[data-api-type]')?.textContent?.trim() === variant.value &&
              !row?.querySelector(`td [data-api-entry="${variant.discriminator}"]`) &&
              document.querySelectorAll(`[data-api-entry="${variant.owner}"]`).length === 1 &&
              document.querySelectorAll(`[data-api-entry="${variant.discriminator}"]`).length === 1,
            )
          }) &&
          expected.generics.every(generic => {
            const element = card.querySelector(`[data-api-generics] [data-api-entry="${generic.id}"]`)
            return Boolean(
              element &&
              !element.closest('table') &&
              element.textContent?.includes(generic.name) &&
              (!generic.constraint || element.textContent?.includes(generic.constraint)) &&
              (!generic.defaultType || element.textContent?.includes(generic.defaultType)),
            )
          }),
        C7:
          headingStyle.fontSize === '16px' &&
          headingStyle.lineHeight === '24px' &&
          style.fontSize === '14px' &&
          style.lineHeight === '21px' &&
          style.paddingTop === '12px' &&
          style.paddingLeft === '16px' &&
          tableStyle.fontSize === '14px' &&
          tableStyle.lineHeight === '21px' &&
          cellStyle.paddingTop === '8px' &&
          cellStyle.paddingLeft === (window.innerWidth <= 575 ? '6px' : '12px') &&
          columnStyle.fontSize === '12px' &&
          columnStyle.lineHeight === '18px' &&
          typeStyle.fontSize === '14px',
      },
    }
  }, expected)
}

export async function probeApiOutput(page: Page) {
  return page.getByRole('heading', { name: 'FullOutput', exact: true }).evaluate(heading => {
    const card = heading.closest('article')!
    const table = card.querySelector('table')!
    const bounds = card.getBoundingClientRect()
    const cells = [...table.querySelectorAll('tbody > tr:first-child > th, tbody > tr:first-child > td')].slice(0, 3)
    return {
      C6output:
        cells.length === 3 &&
        table.scrollWidth <= table.clientWidth + 1 &&
        cells.every(cell => {
          const rect = cell.getBoundingClientRect()
          return rect.left >= bounds.left && rect.right <= bounds.right
        }),
    }
  })
}

export async function apiArticleBox(page: Page) {
  const surface = page.locator('[data-api-surface]').first()
  return surface.evaluate(element => {
    const article = element.closest('article') ?? element.parentElement
    if (!article) throw new Error('Missing article container')
    const rect = article.getBoundingClientRect()
    return { left: rect.left, width: rect.width }
  })
}
