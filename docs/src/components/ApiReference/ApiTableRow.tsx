import CodeBlock from '@theme/CodeBlock'
import type { ApiEntry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import ApiDescription from './ApiDescription'
import ApiSource from './ApiSource'
import styles from './styles.module.css'

export default function ApiTableRow({ entry, depth = 0 }: { entry: ApiEntry; depth?: number }) {
  const typeLinks = new Set(entry.typeContent?.filter(node => node.kind === 'link').map(node => node.href))
  return (
    <>
      <tr data-api-entry={entry.id} id={`${entry.id}-panel`}>
        <th scope="row" style={{ paddingInlineStart: `calc(var(--api-cell-padding, 12px) + ${depth * 8}px)` }}>
          <a id={entry.id} href={`#${entry.id}`}>
            <code>{depth ? entry.name : (entry.label ?? entry.name)}</code>
          </a>
          <ApiSource source={entry.source} sourceUrl={entry.sourceUrl} />
          {entry.optional && <span className={styles.badge}>Optional</span>}
        </th>
        <td className={styles.type}>
          <code data-api-type>
            {entry.typeContent?.length ? <ApiComment nodes={entry.typeContent} /> : (entry.type ?? '—')}
          </code>
        </td>
        <td>
          <ApiDescription entry={entry} />
          {entry.signature && <CodeBlock language="typescript">{entry.signature}</CodeBlock>}
          {entry.nested
            ?.filter(item => !entry.parameterDefinition && 'target' in item && !typeLinks.has(item.target))
            .map(
              item =>
                'target' in item && (
                  <p key={item.target}>
                    <a href={item.target}>{item.name}</a>
                  </p>
                ),
            )}
        </td>
      </tr>
      {entry.nested?.map(
        item =>
          !('target' in item) && (
            <ApiTableRow key={item.id} entry={item} depth={entry.inlineObject ? depth : depth + 1} />
          ),
      )}
    </>
  )
}
