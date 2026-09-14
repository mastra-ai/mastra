import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { repositoryRoot } from '../../scripts/api-reference/config'
import { discoverSurfaces } from '../plugins/remark-api-reference'
import { parseContract } from './schema'

const pages = [
  {
    path: 'configuration.mdx',
    root: '@mastra/core!Config',
    section: 'properties',
    anchors: [
      'configuration',
      'top-level-options',
      'agents',
      'backgroundtasks',
      'deployer',
      'events',
      'gateways',
      'idgenerator',
      'logger',
      'mcpservers',
      'memory',
      'observability',
      'processors',
      'pubsub',
      'scorers',
      'storage',
      'tools',
      'tts',
      'vectors',
      'workflows',
      'workspace',
      'bundler-options',
      'bundlerexternals',
      'bundlersourcemap',
      'bundlerminify',
      'bundlertranspilepackages',
      'server-options',
      'serverapiroutes',
      'serverauth',
      'serverbodysizelimit',
      'servermcpoptions',
      'serverbuild',
      'servercors',
      'serverhandleshutdownsignals',
      'serverhost',
      'serverhttps',
      'servermiddleware',
      'serveronerror',
      'serveronvalidationerror',
      'serverport',
      'serverdraintimeout',
      'serverstudiobase',
      'servertimeout',
    ],
  },
  {
    path: 'agents/generate.mdx',
    root: '@mastra/core/agent!Agent.generate',
    section: 'method',
    anchors: [
      'agentgenerate',
      'usage-example',
      'parameters',
      'response-structure',
      'returns',
      'more-examples',
      'with-model-settings',
      'with-memory',
      'accessing-response-headers',
      'analyzing-images',
      'using-maxsteps',
      'using-onstepfinish',
      'using-ontitlegenerated',
    ],
  },
]

describe('pilot migration', () => {
  it('retains migrated defaults and corrects bundler/CORS guidance in source-backed comments', () => {
    const contract = parseContract(
      JSON.parse(readFileSync(join(repositoryRoot, 'docs/src/data/api-reference/configuration.json'), 'utf8')),
    )
    for (const { owner, text } of [
      { owner: 'logger', text: 'ConsoleLogger' },
      { owner: 'cors', text: 'A2A-Version' },
      { owner: 'cors', text: 'maxAge: 3600' },
      { owner: 'cors', text: 'reflecting the requesting origin' },
      { owner: 'timeout', text: '180000' },
      { owner: 'openAPIDocs', text: 'per-path server URL' },
    ]) {
      const declaration = Object.values(contract.declarations).find(d => d.name === owner && d.id.includes('Config'))
      if (!declaration?.comment) throw new Error(`Missing source comment for ${owner}`)
      const comment = [...declaration.comment.summary, ...declaration.comment.tags.flatMap(tag => tag.content)]
        .map(part => part.text)
        .join('')
      expect(comment, owner).toContain(text)
    }
    const source = readFileSync(join(repositoryRoot, 'docs/src/content/en/reference/configuration.mdx'), 'utf8')
    expect(source).toContain('built-in global externals still apply')
    expect(source).not.toContain('No dependencies are marked as external; everything is bundled together')
  })

  it.each(pages)('keeps legacy anchors and one complete source-backed surface in $path', page => {
    const source = readFileSync(join(repositoryRoot, 'docs/src/content/en/reference', page.path), 'utf8')
    const tree = unified().use(remarkParse).use(remarkMdx).parse(source)
    expect(discoverSurfaces(tree).map(({ root, section }) => ({ root: root.id, section }))).toEqual([
      { root: page.root, section: page.section },
    ])
    expect(source).not.toContain('<PropertiesTable')
    expect(source).not.toContain('MODEL_SETTINGS_OBJECT')
    expect(source).toContain('packages:\n  - "@mastra/core"')
    const anchors: string[] = []
    visit(tree, node => {
      if (node.type === 'heading') {
        const text = node.children
          .map(child => {
            if (child.type !== 'text' && child.type !== 'inlineCode') throw new Error('Unexpected pilot heading markup')
            return child.value
          })
          .join('')
        anchors.push(text.toLowerCase().replace(/[.()]/g, '').replace(/\s+/g, '-'))
      }
      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        for (const attribute of node.attributes) {
          if (attribute.type === 'mdxJsxAttribute' && attribute.name === 'id' && typeof attribute.value === 'string')
            anchors.push(attribute.value)
        }
      }
    })
    for (const anchor of page.anchors)
      expect(
        anchors.filter(value => value === anchor),
        anchor,
      ).toHaveLength(1)
  })

  it('keeps constructor memory navigation pointed at the canonical generate example', () => {
    const source = readFileSync(join(repositoryRoot, 'docs/src/content/en/reference/agents/agent.mdx'), 'utf8')
    expect(source).toContain('## `generate()` memory options')
    expect(source).toContain('/reference/agents/generate#with-memory')
    const generate = readFileSync(join(repositoryRoot, 'docs/src/content/en/reference/agents/generate.mdx'), 'utf8')
    expect(generate).toContain("metadata: { category: 'billing' }")
    expect(generate).toContain("thread: 'user-123-thread'")
  })
})
