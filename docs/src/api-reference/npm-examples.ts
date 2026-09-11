import npmToYarn from '@docusaurus/remark-plugin-npm2yarn'
import type { Root } from 'mdast'
import { unified } from 'unified'
import type { ApiItem, ApiSurface, CommentNode } from './presentation'

export async function prepareExamples(surfaces: ApiSurface[]): Promise<void> {
  async function comments(nodes: CommentNode[]): Promise<void> {
    for (const [index, node] of nodes.entries()) {
      if (node.kind === 'code' && node.npm2yarn) {
        const root: Root = {
          type: 'root',
          children: [{ type: 'code', lang: node.language, meta: 'npm2yarn', value: node.value }],
        }
        await unified()
          .use(npmToYarn, { sync: true, converters: ['pnpm', 'yarn', 'bun'] })
          .run(root)
        const tabs = root.children.find(child => child.type === 'mdxJsxFlowElement' && child.name === 'Tabs')
        if (!tabs || tabs.type !== 'mdxJsxFlowElement') throw new Error('npm-to-yarn did not produce command tabs')
        const items = tabs.children.map(tab => {
          if (tab.type !== 'mdxJsxFlowElement' || tab.name !== 'TabItem') throw new Error('Unexpected npm-to-yarn tab')
          const valueAttribute = tab.attributes.find(
            attribute => attribute.type === 'mdxJsxAttribute' && attribute.name === 'value',
          )
          const labelAttribute = tab.attributes.find(
            attribute => attribute.type === 'mdxJsxAttribute' && attribute.name === 'label',
          )
          if (valueAttribute?.type !== 'mdxJsxAttribute' || typeof valueAttribute.value !== 'string')
            throw new Error('Missing package-manager tab value')
          const label =
            labelAttribute?.type === 'mdxJsxAttribute' && typeof labelAttribute.value === 'string'
              ? labelAttribute.value
              : valueAttribute.value
          const content: CommentNode[] = tab.children.map(code => {
            if (code.type !== 'code') throw new Error('Unexpected npm-to-yarn code')
            return { kind: 'code', value: code.value, ...(code.lang ? { language: code.lang } : {}) }
          })
          return { value: valueAttribute.value, label, content }
        })
        nodes[index] = { kind: 'tabs', items }
      } else if (node.kind === 'link' || node.kind === 'element') await comments(node.children)
    }
  }
  async function entries(items: ApiItem[]): Promise<void> {
    for (const item of items) {
      if ('target' in item) continue
      await Promise.all([item.description, item.deprecated, item.defaults, ...item.examples].map(comments))
      await entries(item.nested ?? [])
    }
  }
  await Promise.all(surfaces.map(surface => entries(surface.entries)))
}
