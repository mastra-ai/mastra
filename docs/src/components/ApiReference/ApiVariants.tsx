import type { ApiEntry, ApiItem } from '../../api-reference/presentation'
import ApiVariantRow from './ApiVariantRow'
import ApiNested from './ApiNested'
import styles from './styles.module.css'

export default function ApiVariants({ items, discriminant }: { items: ApiItem[]; discriminant: string }) {
  const variants = items.filter((item): item is ApiEntry => !('target' in item) && item.variantValue !== undefined)
  const related = items.filter(item => 'target' in item || item.variantValue === undefined)
  return (
    <>
      {Boolean(related.length) && (
        <div data-api-shared-fields>
          Shared fields:{' '}
          {related.map((item, index) =>
            'target' in item ? (
              <span key={item.target}>
                {index > 0 && ', '}
                <a href={item.target}>{item.name}</a>
              </span>
            ) : (
              <ApiNested key={item.id} items={[item]} depth={4} />
            ),
          )}
        </div>
      )}
      <div
        className={styles.tableContainer}
        data-api-table
        role="region"
        tabIndex={0}
        aria-label="Union variants, scroll horizontally for more columns"
      >
        <table className={styles.table} data-api-table aria-label="Union variants">
          <thead>
            <tr>
              <th scope="col">{discriminant}</th>
              <th scope="col">Variant fields</th>
            </tr>
          </thead>
          <tbody>
            {variants.map(variant => (
              <ApiVariantRow key={variant.id} variant={variant} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
