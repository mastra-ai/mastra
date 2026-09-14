import Admonition from '@theme/Admonition'
import type { ApiEntry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import styles from './styles.module.css'

export default function ApiDescription({ entry, examples = true }: { entry: ApiEntry; examples?: boolean }) {
  return (
    <>
      {entry.description.length > 0 ? (
        <ApiComment nodes={entry.description} />
      ) : entry.descriptionRequired !== false ? (
        <Admonition type="warning" title="Missing description">
          Description missing from source JSDoc.
        </Admonition>
      ) : undefined}
      {entry.defaults.length > 0 && (
        <div className={styles.default}>
          Default: <ApiComment nodes={entry.defaults} />
        </div>
      )}
      {entry.deprecated.length > 0 && (
        <Admonition type="warning" title="Deprecated">
          <ApiComment nodes={entry.deprecated} />
        </Admonition>
      )}
      {examples &&
        entry.examples.map((example, index) => (
          <details className={styles.example} key={index}>
            <summary>{entry.examples.length > 1 ? `Example ${index + 1}` : 'Example'}</summary>
            <ApiComment nodes={example} />
          </details>
        ))}
    </>
  )
}
