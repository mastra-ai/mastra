import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

// `Mastra.HeadingSentenceCase` sets `vocab: false`, so it does not see the
// project vocabulary and keeps its own copy in `exceptions:`. This test fails
// when a term is added to accept.txt but not to the heading rule.
const stylesDir = join(dirname(fileURLToPath(import.meta.url)), '../../styles')

const acceptedTerms = readFileSync(join(stylesDir, 'config/vocabularies/Mastra/accept.txt'), 'utf8')
  .split('\n')
  .map(line => line.trim().replace(/^\(\?i\)/, ''))
  .filter(Boolean)

const { exceptions } = parse(readFileSync(join(stylesDir, 'Mastra/HeadingSentenceCase.yml'), 'utf8')) as {
  exceptions: string[]
}

// Vale checks heading words one at a time, so a multi-word term is also
// covered when every word matches an exception on its own. "SharePoint
// Online" relies on this, because a multi-word exception cannot match it.
const isCovered = (term: string) =>
  exceptions.includes(term) ||
  term.split(/\s+/).every(word => exceptions.some(exception => new RegExp(`^(?:${exception})$`).test(word)))

describe('Mastra.HeadingSentenceCase exceptions', () => {
  test('cover every term in the Mastra vocabulary', () => {
    expect(acceptedTerms.filter(term => !isCovered(term))).toEqual([])
  })
})
