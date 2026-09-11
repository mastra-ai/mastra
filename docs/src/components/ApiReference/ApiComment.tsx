import { createElement, Fragment } from 'react'
import CodeBlock from '@theme/CodeBlock'
import ApiCommandTabs from './ApiCommandTabs'
import type { CommentNode } from '../../api-reference/presentation'

export default function ApiComment({ nodes }: { nodes: CommentNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === 'text') return <Fragment key={index}>{node.value}</Fragment>
        if (node.kind === 'tabs') return <ApiCommandTabs key={index} items={node.items} />
        if (node.kind === 'code')
          return (
            <CodeBlock key={index} language={node.language}>
              {node.value}
            </CodeBlock>
          )
        if (node.kind === 'link')
          return (
            <a key={index} href={node.href}>
              <ApiComment nodes={node.children} />
            </a>
          )
        return createElement(
          node.tag,
          { key: index },
          node.tag === 'br' ? undefined : <ApiComment nodes={node.children} />,
        )
      })}
    </>
  )
}
