import CodeBlock from '@theme/CodeBlock'
import Admonition from '@theme/Admonition'
import type { ApiEntry as Entry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import ApiNested from './ApiNested'
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
  return (
    <article className={styles.entry} data-api-entry={entry.id} id={`${entry.id}-panel`} aria-labelledby={entry.id}>
      <header className={hideHeading ? styles.visuallyHidden : styles.header}>
        <Heading id={entry.id}>
          <a href={`#${entry.id}`}>
            <code>{entry.name}</code>
          </a>
        </Heading>
        {entry.optional && <span className={styles.badge}>Optional</span>}
        {entry.deprecated.length > 0 && <span className={styles.deprecatedBadge}>Deprecated</span>}
      </header>
      <div className={styles.metadata}>
        {entry.type && (
          <span className={styles.type}>
            Type: <code>{entry.typeContent ? <ApiComment nodes={entry.typeContent} /> : entry.type}</code>
          </span>
        )}
        {entry.defaults.length > 0 && (
          <div className={styles.default}>
            Default: <ApiComment nodes={entry.defaults} />
          </div>
        )}
        {entry.sourceUrl ? (
          <a className={styles.source} href={entry.sourceUrl} title={entry.source}>
            Source
          </a>
        ) : (
          entry.source && (
            <span className={styles.source} title={entry.source}>
              {entry.source}
            </span>
          )
        )}
      </div>
      {entry.signature && <CodeBlock language="typescript">{entry.signature}</CodeBlock>}
      {entry.description.length > 0 ? (
        <ApiComment nodes={entry.description} />
      ) : (
        entry.descriptionRequired !== false && (
          <Admonition type="warning" title="Missing description">
            Description missing from source JSDoc.
          </Admonition>
        )
      )}
      {entry.deprecated.length > 0 && (
        <Admonition type="warning" title="Deprecated">
          <ApiComment nodes={entry.deprecated} />
        </Admonition>
      )}
      {entry.examples.map((example, index) => (
        <details className={styles.example} key={index}>
          <summary>{entry.examples.length > 1 ? `Example ${index + 1}` : 'Example'}</summary>
          <ApiComment nodes={example} />
        </details>
      ))}
      {entry.nested && entry.nested.length > 0 && <ApiNested items={entry.nested} depth={depth + 1} />}
    </article>
  )
}
