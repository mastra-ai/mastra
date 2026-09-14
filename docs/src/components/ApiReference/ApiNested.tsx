import type { ApiItem } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import styles from './styles.module.css'

export default function ApiNested({ items, depth }: { items: ApiItem[]; depth: number }) {
  return (
    <div className={styles.nested} data-api-nested>
      {items.map(item =>
        'target' in item ? (
          <p key={item.target}>
            <a href={item.target}>{item.name}</a>
          </p>
        ) : (
          <ApiEntry key={item.id} entry={item} depth={depth} />
        ),
      )}
    </div>
  )
}
