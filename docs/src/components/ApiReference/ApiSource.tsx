import type { ApiEntry } from '../../api-reference/presentation'
import styles from './styles.module.css'

export default function ApiSource({ source, sourceUrl }: Pick<ApiEntry, 'source' | 'sourceUrl'>) {
  if (!source) return undefined
  return (
    <span className={styles.source} data-api-source={source}>
      {sourceUrl ? (
        <a href={sourceUrl} title={source} aria-label={`Source: ${source}`}>
          Source
        </a>
      ) : (
        <span title={source}>
          <span aria-hidden="true">{source.slice(source.lastIndexOf('/') + 1)}</span>
          <span className={styles.visuallyHidden}>Source: {source}</span>
        </span>
      )}
    </span>
  )
}
