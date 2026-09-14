import CodeBlock from '@theme/CodeBlock'
import type { ApiEntry as Entry } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import ApiDescription from './ApiDescription'
import ApiComment from './ApiComment'
import ApiSource from './ApiSource'
import styles from './styles.module.css'

export default function ApiMethod({ entry }: { entry: Entry }) {
  const generics = entry.nested?.filter(item => !('target' in item) && item.kind === 'TypeParameter') ?? []
  const content = entry.nested?.filter(item => 'target' in item || item.kind !== 'TypeParameter') ?? []
  return (
    <article
      className={`${styles.entry} ${styles.method}`}
      data-api-entry={entry.id}
      id={`${entry.id}-panel`}
      aria-labelledby={entry.id}
    >
      <header className={styles.header}>
        <h3 id={entry.id} data-api-call>
          <a href={`#${entry.id}`}>
            <code>{entry.callSummary}</code>
          </a>
        </h3>
        <ApiSource source={entry.source} sourceUrl={entry.sourceUrl} />
      </header>
      {generics.length > 0 && (
        <p className={styles.metadata}>
          Type parameters:{' '}
          {generics.map(
            (generic, index) =>
              !('target' in generic) && (
                <span key={generic.id}>
                  {index > 0 && ', '}
                  <a href={`#${generic.id}`}>
                    <code>{generic.name}</code>
                  </a>
                </span>
              ),
          )}
        </p>
      )}
      <ApiDescription entry={entry} examples={false} />
      {content.map(item =>
        'target' in item ? (
          <p key={item.target}>
            <a href={item.target}>{item.name}</a>
          </p>
        ) : (
          <ApiEntry key={item.id} entry={item} depth={4} />
        ),
      )}
      <details className={styles.example}>
        <summary>TypeScript declaration</summary>
        <CodeBlock language="typescript">{entry.signature ?? ''}</CodeBlock>
        {generics.map(generic => !('target' in generic) && <ApiEntry key={generic.id} entry={generic} depth={4} />)}
      </details>
      {entry.examples.map((example, index) => (
        <details className={styles.example} key={index}>
          <summary>{entry.examples.length > 1 ? `Example ${index + 1}` : 'Example'}</summary>
          <ApiComment nodes={example} />
        </details>
      ))}
    </article>
  )
}
