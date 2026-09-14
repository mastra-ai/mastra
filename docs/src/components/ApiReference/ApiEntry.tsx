import CodeBlock from '@theme/CodeBlock'
import type { ApiEntry as Entry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import ApiDescription from './ApiDescription'
import ApiNested from './ApiNested'
import ApiTable from './ApiTable'
import ApiVariants from './ApiVariants'
import ApiMethod from './ApiMethod'
import ApiSource from './ApiSource'
import ApiTypeParameters from './ApiTypeParameters'
import styles from './styles.module.css'

export default function ApiEntry({
  entry,
  depth = 3,
  hideHeading = false,
}: {
  entry: Entry
  depth?: number
  hideHeading?: boolean
}) {
  const Heading = depth === 3 ? 'h3' : depth === 4 ? 'h4' : depth === 5 ? 'h5' : 'h6'
  if (entry.callSummary) return <ApiMethod entry={entry} />
  const namedType = entry.kind && ['Interface', 'TypeAlias', 'Class', 'Enum'].includes(entry.kind)
  const generics =
    entry.nested?.filter((item): item is Entry => !('target' in item) && item.kind === 'TypeParameter') ?? []
  const typeLinks = new Set(entry.typeContent?.filter(node => node.kind === 'link').map(node => node.href))
  const nested =
    entry.nested?.filter(item =>
      'target' in item ? !entry.returnValue || !typeLinks.has(item.target) : item.kind !== 'TypeParameter',
    ) ?? []
  return (
    <article
      className={`${styles.entry}${namedType ? ` ${styles.namedType}` : ''}`}
      data-api-entry={entry.id}
      id={`${entry.id}-panel`}
      aria-labelledby={entry.id}
    >
      <header
        className={hideHeading ? styles.visuallyHidden : styles.header}
        data-api-returns={entry.returnValue || undefined}
      >
        <Heading id={entry.id}>
          <a href={`#${entry.id}`}>
            <code>{entry.returnValue ? 'Returns:' : (entry.label ?? entry.name)}</code>
          </a>
        </Heading>
        {entry.returnValue && (
          <code data-api-type>{entry.typeContent ? <ApiComment nodes={entry.typeContent} /> : entry.type}</code>
        )}
        <ApiSource source={entry.source} sourceUrl={entry.sourceUrl} />
        {entry.optional && <span className={styles.badge}>Optional</span>}
        {entry.deprecated.length > 0 && <span className={styles.deprecatedBadge}>Deprecated</span>}
      </header>
      <div className={styles.metadata}>
        {entry.path && (
          <span className={styles.path}>
            Path: <code>{entry.path}</code>
          </span>
        )}
        {entry.type && !entry.returnValue && (
          <span className={styles.type}>
            {entry.kind === 'TypeParameter' ? 'Constraint:' : 'Type:'}{' '}
            <code data-api-type>{entry.typeContent ? <ApiComment nodes={entry.typeContent} /> : entry.type}</code>
          </span>
        )}
        {entry.defaultType && (
          <span>
            Default type: <code>{entry.defaultType}</code>
          </span>
        )}
      </div>
      {entry.signature && <CodeBlock language="typescript">{entry.signature}</CodeBlock>}
      <ApiDescription entry={entry} />
      {Boolean(generics.length) && <ApiTypeParameters items={generics} />}
      {Boolean(nested.length) &&
        (entry.variantKey ? (
          <ApiVariants items={nested} discriminant={entry.variantKey} />
        ) : entry.table ? (
          <ApiTable items={nested} label={entry.table} />
        ) : (
          <ApiNested items={nested} depth={depth + 1} />
        ))}
    </article>
  )
}
