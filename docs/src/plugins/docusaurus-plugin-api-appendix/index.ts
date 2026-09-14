import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { LoadContext, Plugin } from '@docusaurus/types'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import * as v from 'valibot'
import { artifactDirectory } from '../../../scripts/api-reference/config'
import { partitionMethod } from '../../api-reference/appendix'
import { discoverSurfaces, prepareReference } from '../remark-api-reference'

const contentSchema = v.object({
  loadedVersions: v.array(
    v.object({
      docs: v.array(
        v.object({ source: v.string(), permalink: v.string(), title: v.string(), sidebar: v.optional(v.string()) }),
      ),
    }),
  ),
})

export default function apiAppendix(context: LoadContext): Plugin {
  return {
    name: 'docusaurus-plugin-api-appendix',
    getPathsToWatch() {
      return [join(artifactDirectory, '*.json')]
    },
    async allContentLoaded({ allContent, actions }) {
      const content = v.parse(contentSchema, allContent['docusaurus-plugin-content-docs']?.reference)
      const registry: Record<string, string> = {}
      const occupied = new Set(
        content.loadedVersions.flatMap(version => version.docs.map(doc => doc.permalink.replace(/\/$/, ''))),
      )
      for (const version of content.loadedVersions)
        for (const doc of version.docs) {
          if (!doc.source.startsWith('@site/')) throw new Error(`Unsupported reference source: ${doc.source}`)
          const path = resolve(context.siteDir, doc.source.slice('@site/'.length))
          const text = readFileSync(path, 'utf8')
          if (!text.includes('ApiReference')) continue
          const tree = unified().use(remarkParse).use(remarkMdx).parse(text)
          const selections = discoverSurfaces(tree)
          if (!selections.some(selection => selection.section === 'method')) continue
          const surfaces = await prepareReference(selections, { path, message: message => console.warn(message) })
          const method = surfaces.find(surface => surface.section === 'method')
          if (!method) throw new Error(`Missing method surface: ${path}`)
          const partition = partitionMethod(
            method,
            doc.permalink.replace(/\/$/, ''),
            surfaces.filter(surface => surface !== method),
          )
          if (occupied.has(partition.appendixPath))
            throw new Error(`API appendix route collision: ${partition.appendixPath}`)
          occupied.add(partition.appendixPath)
          registry[path] = partition.methodPath
          const data = await actions.createData(
            `${createHash('sha256').update(partition.appendixPath).digest('hex')}.json`,
            JSON.stringify({
              surface: partition.appendix,
              methodPath: partition.methodPath,
              hasSidebar: Boolean(doc.sidebar),
              title: `${doc.title}: supporting types`,
            }),
          )
          actions.addRoute({
            path: partition.appendixPath,
            component: '@site/src/components/ApiReference/ApiAppendixPage',
            exact: true,
            modules: { data },
          })
        }
      const directory = join(context.siteDir, '.docusaurus/api-reference')
      mkdirSync(directory, { recursive: true })
      const path = join(directory, 'routes.json')
      const text = JSON.stringify(registry)
      if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text)
    },
  }
}
