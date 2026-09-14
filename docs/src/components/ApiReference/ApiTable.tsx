import type { ApiItem } from '../../api-reference/presentation'
import ApiTableRow from './ApiTableRow'
import styles from './styles.module.css'

export default function ApiTable({ items, label }: { items: ApiItem[]; label: 'Parameter' | 'Property' }) {
  return (
    <div
      className={styles.tableContainer}
      data-api-table
      tabIndex={0}
      role="region"
      aria-label={`${label} table, scroll horizontally for more columns`}
    >
      <table className={styles.table} data-api-table aria-label={`${label} details`}>
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col">Type</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item =>
            'target' in item ? (
              <tr key={item.target}>
                <td colSpan={3}>
                  <a href={item.target}>{item.name}</a>
                </td>
              </tr>
            ) : (
              <ApiTableRow key={item.id} entry={item} />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}
