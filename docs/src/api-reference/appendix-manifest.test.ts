import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { generateManifest } from '../plugins/docusaurus-plugin-llms-txt/manifest-generator'

it('attributes only registered generated appendices to their consuming page packages', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-appendix-manifest-'))
  try {
    mkdirSync(join(directory, '.docusaurus/api-reference'), { recursive: true })
    const source = join(directory, 'method.mdx')
    writeFileSync(source, '---\ntitle: Generate\npackages:\n  - "@mastra/core"\n---\n')
    writeFileSync(
      join(directory, '.docusaurus/api-reference/routes.json'),
      JSON.stringify({ [source]: '/reference/generated-method' }),
    )
    const manifest = await generateManifest(
      [
        { route: '/reference/generated-method/types', title: 'Generate: supporting types' },
        { route: '/reference/unregistered/types', title: 'Unregistered' },
      ],
      directory,
      directory,
    )
    expect(manifest.packages['@mastra/core']).toHaveLength(1)
    expect(manifest.packages['@mastra/core'][0]).toMatchObject({
      path: 'reference/generated-method/types/llms.txt',
      title: 'Generate: supporting types',
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
