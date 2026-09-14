import type { ApiEntry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import ApiDescription from './ApiDescription'
import ApiTable from './ApiTable'
import ApiSource from './ApiSource'

export default function ApiVariantField({
  field,
  discriminator = false,
}: {
  field: ApiEntry
  discriminator?: boolean
}) {
  const typeLinks = new Set(field.typeContent?.filter(node => node.kind === 'link').map(node => node.href))
  const nested = field.nested?.filter(item => !('target' in item) || !typeLinks.has(item.target)) ?? []
  return (
    <section data-api-entry={field.id} id={field.id}>
      <code data-api-type>
        {!discriminator && (
          <>
            {field.label ?? field.name}
            {field.optional ? '?' : ''}:{' '}
          </>
        )}
        <ApiComment nodes={field.typeContent ?? [{ kind: 'text', value: field.type ?? '' }]} />
      </code>
      <ApiSource source={field.source} sourceUrl={field.sourceUrl} />
      <ApiDescription entry={field} />
      {Boolean(nested.length) && <ApiTable items={nested} label="Property" />}
    </section>
  )
}
